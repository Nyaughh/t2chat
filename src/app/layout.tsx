import type { Metadata } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { ConvexClientProvider } from './_providers/ConvexProvider'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'T2Chat - Advanced AI Chat Interface',
  description: 'Modern AI chat interface with multiple model support',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script crossOrigin="anonymous" async src="//unpkg.com/react-scan/dist/auto.global.js" />
      </head>
      <body className={`${inter.variable} ${interTight.variable} antialiased`} suppressHydrationWarning>
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
