import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import {
  Atkinson_Hyperlegible,
  Fira_Code,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Lora,
  Roboto_Slab,
  Source_Code_Pro,
} from 'next/font/google'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { fetchQuery } from 'convex/nextjs'
import { api } from '../../convex/_generated/api'
import { getToken } from '@/lib/auth-server'
import { ConvexClientProvider } from './_providers/ConvexProvider'
import { AppearanceProvider } from '@/components/theme/AppearanceProvider'
import { APPEARANCE_BOOT_ID } from '@/lib/theme/appearance'
import { cn } from '@/lib/utils'

/*
 * Every selectable font is declared here so its CSS variable always exists,
 * but only the defaults (Inter, Fira Code) are preloaded. The others are
 * fetched by the browser only once a user actually selects them.
 */
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const firaCode = Fira_Code({ variable: '--font-fira-code', subsets: ['latin'], display: 'swap' })

// next/font needs literal options, so `preload: false` is spelled out on each.
const geist = Geist({ variable: '--font-geist', subsets: ['latin'], display: 'swap', preload: false })
const ibmPlexSans = IBM_Plex_Sans({ variable: '--font-ibm-plex-sans', subsets: ['latin'], display: 'swap', preload: false })
const atkinson = Atkinson_Hyperlegible({ variable: '--font-atkinson', weight: ['400', '700'], subsets: ['latin'], display: 'swap', preload: false })
const lora = Lora({ variable: '--font-lora', subsets: ['latin'], display: 'swap', preload: false })
const robotoSlab = Roboto_Slab({ variable: '--font-roboto-slab', subsets: ['latin'], display: 'swap', preload: false })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-jetbrains-mono', subsets: ['latin'], display: 'swap', preload: false })
const sourceCodePro = Source_Code_Pro({ variable: '--font-source-code-pro', subsets: ['latin'], display: 'swap', preload: false })
const ibmPlexMono = IBM_Plex_Mono({ variable: '--font-ibm-plex-mono', weight: ['400', '500', '600'], subsets: ['latin'], display: 'swap', preload: false })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap', preload: false })

const fontVariables = cn(
  inter.variable,
  firaCode.variable,
  geist.variable,
  ibmPlexSans.variable,
  atkinson.variable,
  lora.variable,
  robotoSlab.variable,
  jetbrainsMono.variable,
  sourceCodePro.variable,
  ibmPlexMono.variable,
  geistMono.variable,
)

/** Absolute base for OG/manifest URLs: the canonical app URL (same source as middleware.ts). */
function siteUrl(): URL {
  try {
    return new URL(process.env.BETTER_AUTH_URL || 'https://chat.lh3k.dev')
  } catch {
    return new URL('https://chat.lh3k.dev')
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'T2Chat',
  description: 'Modern AI chat interface with multiple model support',
  manifest: '/site.webmanifest',
  openGraph: {
    images: [
      {
        url: '/T2Chat.jpg',
        width: 1200,
        height: 630,
        alt: 'T2Chat',
      },
    ],
  },
}

declare const APPEARANCE_BOOT_SCRIPT: string

async function getInitialAccount() {
  try {
    const token = await getToken()
    return token ? await fetchQuery(api.appearance.getAppearance, {}, { token }) : null
  } catch (error) {
    unstable_rethrow(error)
    console.error('Failed to load initial appearance', error)
    return undefined
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const account = await getInitialAccount()
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Applies saved theme/font/size variables before first paint (no flash of the default). */}
        <script
          id={APPEARANCE_BOOT_ID}
          data-account={JSON.stringify(account)}
          dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AppearanceProvider>{children}</AppearanceProvider>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
