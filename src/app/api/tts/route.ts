import { getToken } from '@/lib/auth-server'

export const maxDuration = 60

/**
 * Gemini text-to-speech, using the signed-in user's own Gemini API key. Saved
 * keys can only be decrypted inside Convex, so this route forwards the request
 * with the user's Convex token to the /tts HTTP action (convex/tts.ts), which
 * checks the input caps and rate limits, calls Gemini and streams raw 16-bit
 * mono PCM at 24 kHz back through here. No key ever reaches the browser.
 */

const json = (status: number, error: string) => Response.json({ error }, { status })

export async function POST(req: Request) {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  if (!convexSiteUrl) return json(503, "Gemini voices aren't set up on this server.")

  let token: string | undefined
  try {
    token = await getToken()
  } catch {
    token = undefined
  }
  if (!token) return json(401, 'Sign in to use Gemini voices.')

  let upstream: Response
  try {
    upstream = await fetch(new URL('/tts', convexSiteUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: await req.text(),
      signal: req.signal,
    })
  } catch {
    return json(502, "Couldn't reach Gemini voices. Try again.")
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' })
  for (const name of ['Content-Type', 'Retry-After']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}
