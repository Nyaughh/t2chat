import type { Metadata } from 'next'
import { Inter, Inter_Tight, Fira_Code, Roboto_Slab, Source_Code_Pro } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { ConvexClientProvider } from './_providers/ConvexProvider'
import { cookies } from 'next/headers'
import { cn } from '@/lib/utils'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
})

const firaCode = Fira_Code({
  variable: '--font-fira-code',
  subsets: ['latin'],
})

const robotoSlab = Roboto_Slab({
  variable: '--font-roboto-slab',
  subsets: ['latin'],
})

const sourceCodePro = Source_Code_Pro({
  variable: '--font-source-code-pro',
  subsets: ['latin'],
})

export const metadata: Metadata = {
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const mainFont = cookieStore.get('mainFont')?.value || 'inter'
  const codeFont = cookieStore.get('codeFont')?.value || 'fira-code'

  const fontClasses = {
    inter: inter.variable,
    system: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
    'roboto-slab': robotoSlab.variable,
  }

  const codeFontClasses = {
    'fira-code': firaCode.variable,
    mono: 'font-mono',
    consolas: 'font-consolas',
    jetbrains: 'font-jetbrains',
    'source-code-pro': sourceCodePro.variable,
  }

  const bodyClassName = cn(
    'antialiased',
    fontClasses[mainFont as keyof typeof fontClasses],
    codeFontClasses[codeFont as keyof typeof codeFontClasses],
    interTight.variable
  )

  return (
    <html lang="en" suppressHydrationWarning>
      <head>{/* <script crossOrigin="anonymous" async src="//unpkg.com/react-scan/dist/auto.global.js" /> */}</head>
      <body className={bodyClassName} suppressHydrationWarning>
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
