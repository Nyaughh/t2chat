import { fetchQuery } from 'convex/nextjs'
import { getToken } from '@convex-dev/better-auth/nextjs'
import { api } from '../../../../convex/_generated/api'
import { createAuth } from '../../../../convex/auth'
import { GEMINI_TTS_MODEL, TTS_MAX_CHARS, TTS_RATE_LIMITS } from '@/lib/tts/limits'
import { GEMINI_VOICE_IDS, DEFAULT_GEMINI_VOICE } from '@/lib/tts/voices'

export const maxDuration = 60

/**
 * Gemini text-to-speech for signed-in users. Streams raw 16-bit mono PCM at
 * 24 kHz. Not an open proxy: it requires a session, caps the input length and
 * rate-limits each user. The server key never leaves the server.
 */

const json = (status: number, error: string, headers?: Record<string, string>) =>
  Response.json({ error }, { status, headers })

// In-memory, per server instance. Good enough to stop casual abuse; the
// Convex-backed version will replace it.
const usage = new Map<string, { minute: number[]; hour: { at: number; chars: number }[] }>()

const checkRateLimit = (userId: string, chars: number) => {
  const now = Date.now()
  const entry = usage.get(userId) ?? { minute: [], hour: [] }
  entry.minute = entry.minute.filter((t) => now - t < 60_000)
  entry.hour = entry.hour.filter((h) => now - h.at < 3_600_000)
  const hourChars = entry.hour.reduce((sum, h) => sum + h.chars, 0)

  if (entry.minute.length >= TTS_RATE_LIMITS.requestsPerMinute) {
    return { ok: false as const, retryAfter: Math.ceil((60_000 - (now - entry.minute[0])) / 1000) }
  }
  if (hourChars + chars > TTS_RATE_LIMITS.charsPerHour) {
    return { ok: false as const, retryAfter: Math.ceil((3_600_000 - (now - entry.hour[0].at)) / 1000) }
  }
  entry.minute.push(now)
  entry.hour.push({ at: now, chars })
  usage.set(userId, entry)

  // Keep the map from growing without bound
  if (usage.size > 5000) {
    for (const [key, value] of usage) {
      if (!value.hour.some((h) => now - h.at < 3_600_000)) usage.delete(key)
    }
  }
  return { ok: true as const }
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return json(503, "Gemini voices aren't set up on this server.")

  // Auth: only signed-in users may use the server's key.
  let userId: string | undefined
  try {
    const token = await getToken(createAuth)
    const user = token ? await fetchQuery(api.auth.getCurrentUser, {}, { token }) : null
    userId = user?.userId ?? user?._id ?? undefined
  } catch {
    userId = undefined
  }
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

  const limit = checkRateLimit(userId, text.length)
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
      signal: req.signal,
    })
  } catch {
    return json(502, "Couldn't reach Gemini. Try again.")
  }

  if (!upstream.ok || !upstream.body) {
    // Never forward the provider's error body; it can echo request details.
    if (upstream.status === 429) return json(429, 'Gemini voices are busy right now. Try again in a minute.')
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
            controller.enqueue(Uint8Array.from(Buffer.from(parsed.delta.data, 'base64')))
            emitted = true
          } else if (parsed.event_type === 'error' || parsed.event_type === 'interaction.failed') {
            console.error('[tts] Gemini stream reported an error')
            controller.error(new Error('TTS stream failed'))
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
}
