import path from 'path'
import { buildSync } from 'esbuild'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

/** Origin of a configured URL, or null if it's unset or invalid. */
function originOf(url: string | undefined, protocol?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (protocol) parsed.protocol = protocol
    return parsed.origin
  } catch {
    return null
  }
}

// Convex: the client's HTTPS + WebSocket endpoints, plus the HTTP actions site.
// The wildcards cover any deployment; the env origins cover a custom domain.
const convexSources = [
  'https://*.convex.cloud',
  'wss://*.convex.cloud',
  'https://*.convex.site',
  originOf(process.env.NEXT_PUBLIC_CONVEX_URL),
  originOf(process.env.NEXT_PUBLIC_CONVEX_URL, 'wss:'),
  originOf(process.env.NEXT_PUBLIC_CONVEX_SITE_URL),
]

// UploadThing: presigned uploads go to *.ingest.uploadthing.com, files are served from ufs.sh / utfs.io.
const uploadSources = ['https://*.uploadthing.com', 'https://*.ufs.sh', 'https://utfs.io']

// On-device TTS model: huggingface.co redirects to its LFS / Xet CDNs.
const huggingFaceSources = ['https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.co']

// Vercel's preview toolbar (preview deployments only).
const vercelLive = process.env.VERCEL_ENV === 'preview' ? ['https://vercel.live'] : []

const csp: Record<string, (string | null)[]> = {
  'default-src': ["'self'"],
  // App Router streams inline bootstrap scripts and the appearance boot script is
  // inline, so 'unsafe-inline' is required without nonces. Dev adds eval for HMR.
  'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...vercelLive],
  'style-src': ["'self'", "'unsafe-inline'"],
  // Chat markdown and web-search results show images from arbitrary hosts.
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'media-src': ["'self'", 'data:', 'blob:'],
  'connect-src': [
    "'self'",
    ...convexSources,
    ...uploadSources,
    ...huggingFaceSources,
    ...(isDev ? ['ws:'] : []),
    ...vercelLive,
  ],
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ["'self'", ...vercelLive],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
}

const contentSecurityPolicy = Object.entries(csp)
  .map(([directive, sources]) => [directive, ...new Set(sources.filter(Boolean))].join(' '))
  .join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Microphone stays available to this origin for voice input.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
]

const nextConfig: NextConfig = {
  // Run the same appearance resolver before paint and after hydration.
  compiler: {
    defineServer: {
      APPEARANCE_BOOT_SCRIPT: buildSync({
        entryPoints: [path.join(__dirname, 'src/lib/theme/boot.ts')],
        bundle: true,
        minify: true,
        write: false,
      }).outputFiles[0].text,
    },
  },
  poweredByHeader: false,
  // A lockfile in a parent directory would otherwise make Next guess the wrong workspace root.
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: { root: path.resolve(__dirname) },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
