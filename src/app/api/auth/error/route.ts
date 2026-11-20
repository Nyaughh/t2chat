import { NextRequest, NextResponse } from 'next/server'

// Better Auth sends some OAuth callback failures (provider cancellation,
// missing or expired state) to its default `${baseURL}/error` page before it
// reads the request's errorCallbackURL. This static route takes precedence over
// the /api/auth/[...all] proxy and sends those users back to the sign-in page,
// keeping only a sanitized error code.
export function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('error') ?? ''
  const code = /^[A-Za-z0-9_]{1,64}$/.test(raw) ? raw : 'unknown'

  const url = new URL('/auth', request.nextUrl.origin)
  url.searchParams.set('error', code)
  return NextResponse.redirect(url, 302)
}
