import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_CANONICAL_URL = 'https://chat.lh3k.dev'

// Better Auth issues OAuth callbacks and session cookies for a single origin
// (BETTER_AUTH_URL). In production, send page visits on any other host (e.g.
// t2chat.vercel.app) to the canonical domain so sign-in starts and finishes
// on the same host.
export function middleware(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.next()
  }

  let canonical: URL
  try {
    canonical = new URL(process.env.BETTER_AUTH_URL || DEFAULT_CANONICAL_URL)
  } catch {
    return NextResponse.next()
  }

  const host = request.headers.get('host')
  if (!host || host === canonical.host) {
    return NextResponse.next()
  }

  // Start from the trusted origin and only copy path and query, so a request
  // path like "//evil.example" can never change the redirect's host.
  const url = new URL(canonical.origin)
  url.pathname = request.nextUrl.pathname
  url.search = request.nextUrl.search
  return NextResponse.redirect(url, 308)
}

export const config = {
  // Pages only: leave API routes (auth proxy, uploadthing callbacks) and static assets alone.
  matcher: ['/((?!api/|_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}
