import { ConvexError, v } from 'convex/values'
import { httpAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { getAuthUserId } from './auth'
import { getUserApiKey } from './api_keys'
import { GEMINI_TTS_MODEL, TTS_MAX_CHARS, TTS_RATE_LIMITS } from '../src/lib/tts/limits'
import { GEMINI_VOICE_IDS, DEFAULT_GEMINI_VOICE } from '../src/lib/tts/voices'

/**
 * Gemini text-to-speech with the caller's own saved Gemini API key. Streams raw
 * 16-bit mono PCM at 24 kHz. The app's /api/tts route forwards the user's
 * Convex token here; the key is decrypted only inside this action and never
 * leaves the server. There is no server-key fallback.
 */

const MINUTE = 60_000
const HOUR = 3_600_000

const json = (status: number, error: string, headers?: Record<string, string>) =>
  Response.json({ error }, { status, headers })

/** Records one request against the caller's limits, or says how long to wait. */
export const consumeTtsQuota = internalMutation({
  args: { chars: v.number() },
  handler: async (ctx, { chars }): Promise<{ ok: true } | { ok: false; retryAfter: number }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Not authenticated')

    const now = Date.now()
    const row = await ctx.db
      .query('ttsUsage')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
    const requests = (row?.requests ?? []).filter((r) => now - r.at < HOUR)
    const lastMinute = requests.filter((r) => now - r.at < MINUTE)
    const hourChars = requests.reduce((sum, r) => sum + r.chars, 0)

    if (lastMinute.length >= TTS_RATE_LIMITS.requestsPerMinute) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((MINUTE - (now - lastMinute[0].at)) / 1000)) }
    }
    if (requests.length > 0 && hourChars + chars > TTS_RATE_LIMITS.charsPerHour) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((HOUR - (now - requests[0].at)) / 1000)) }
    }

    requests.push({ at: now, chars })
    if (row) await ctx.db.patch(row._id, { requests })
    else await ctx.db.insert('ttsUsage', { userId, requests })
    return { ok: true }
  },
})

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))

export const geminiTts = httpAction(async (ctx, req) => {
  // A malformed or expired token throws here; treat it as signed out.
  const userId = await getAuthUserId(ctx).catch(() => null)
  if (!userId) return json(401, 'Sign in to use Gemini voices.')

  let body: { text?: unknown; voice?: unknown }
  try {
    const parsed: unknown = await req.json()
    // Valid JSON can still be null, an array or a primitive.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json(400, 'Invalid request.')
    body = parsed
  } catch {
    return json(400, 'Invalid request.')
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return json(400, 'Nothing to read.')
  if (text.length > TTS_MAX_CHARS) return json(413, `Text is too long (max ${TTS_MAX_CHARS} characters per request).`)
  const voice = typeof body.voice === 'string' && GEMINI_VOICE_IDS.has(body.voice) ? body.voice : DEFAULT_GEMINI_VOICE

  let apiKey: string | null
  try {
    apiKey = await getUserApiKey(ctx, 'gemini')
  } catch (error) {
    if (error instanceof ConvexError && typeof error.data === 'string') return json(400, error.data)
    return json(500, "Couldn't read your Gemini API key. Try again.")
  }
  if (!apiKey) return json(403, 'Gemini voices use your own Gemini API key. Add one in Settings → API Keys.')

  const limit = await ctx.runMutation(internal.tts.consumeTtsQuota, { chars: text.length })
  if (!limit.ok) {
    return json(429, 'You’ve hit the Gemini voice limit for now. Try again shortly.', {
      'Retry-After': String(limit.retryAfter),
    })
  }

  let upstream: Response
  try {
    upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMINI_TTS_MODEL,
        input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
        response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000 },
        generation_config: { speech_config: [{ voice }] },
        stream: true,
      }),
    })
  } catch {
    return json(502, "Couldn't reach Gemini. Try again.")
  }

  if (!upstream.ok || !upstream.body) {
    // Never forward or log the provider's error body; it can echo request details.
    // It is only checked for Google's invalid-key reason.
    const errorBody = await upstream.text().catch(() => '')
    if (upstream.status === 429) return json(429, 'Your Gemini API key hit its rate limit. Try again in a minute.')
    if (upstream.status === 401 || upstream.status === 403 || errorBody.includes('API_KEY_INVALID')) {
      return json(502, 'Gemini rejected your API key. Check it in Settings → API Keys.')
    }
    console.error('[tts] Gemini TTS failed with status', upstream.status)
    return json(502, "Gemini couldn't generate audio right now.")
  }

  // Convert the SSE event stream into a plain PCM byte stream.
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        buffer += decoder.decode(value, { stream: true })
        let emitted = false
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const data = event
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('')
          if (!data || data === '[DONE]') continue
          let parsed: { event_type?: string; delta?: { type?: string; data?: string } }
          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }
          if (parsed.event_type === 'step.delta' && parsed.delta?.type === 'audio' && parsed.delta.data) {
            controller.enqueue(base64ToBytes(parsed.delta.data))
            emitted = true
          } else if (parsed.event_type === 'error' || parsed.event_type === 'interaction.failed') {
            console.error('[tts] Gemini stream reported an error')
            controller.error(new Error('TTS stream failed'))
            void reader.cancel()
            return
          }
        }
        if (emitted) return
      }
    },
    cancel() {
      void reader.cancel()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'audio/L16; rate=24000; channels=1',
      'Cache-Control': 'no-store',
    },
  })
})
