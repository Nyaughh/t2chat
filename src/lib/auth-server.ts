import { headers } from 'next/headers'
import { getSessionCookie } from 'better-auth/cookies'
import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs'

// Server-side auth: the /api/auth proxy handler and a Convex token for the
// current request, fetched from the auth server with the request's cookies.
const auth = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
})

export const { handler } = auth

/** Convex token for the signed-in user, or undefined for guests (no auth server round trip). */
export async function getToken(): Promise<string | undefined> {
  if (!getSessionCookie(await headers())) return undefined
  return auth.getToken()
}
