import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { ConvexClientProvider } from './_providers/ConvexProvider'
import WorkerInitializer from '@/components/WorkerInitializer'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'T2 Chat - AI Assistant',
  description: 'Advanced AI chat application with multiple models, voice chat, and offline support',
  keywords: ['AI', 'Chat', 'Assistant', 'GPT', 'Gemini', 'Voice Chat', 'Offline'],
  authors: [{ name: 'T2 Chat Team' }],
  creator: 'T2 Chat',
  publisher: 'T2 Chat',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'T2 Chat',
  },
  openGraph: {
    title: 'T2 Chat - AI Assistant',
    description: 'Advanced AI chat application with multiple models, voice chat, and offline support',
    images: [
      {
        url: '/T2Chat.jpg',
        width: 1200,
        height: 630,
        alt: 'T2Chat',
      },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'T2 Chat',
    'msapplication-TileColor': '#000000',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="T2 Chat" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/sw.js" as="script" />
        <link rel="dns-prefetch" href="https://api.convex.cloud" />
        
        {/* <script crossOrigin="anonymous" async src="//unpkg.com/react-scan/dist/auto.global.js" /> */}
      </head>
      <body className={`${inter.variable} ${interTight.variable} antialiased`} suppressHydrationWarning>
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <WorkerInitializer />
            {children}
            <Toaster />
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
