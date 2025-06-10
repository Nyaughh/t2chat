import type { Metadata } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import { ConvexClientProvider } from '@/components/ConvexClientProvider'

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
        {/* <script
          crossOrigin="anonymous"
          async
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
        rest of your scripts go under */}
      </head>
      <body className={`${inter.variable} ${interTight.variable} antialiased`} suppressHydrationWarning>
        <AuthKitProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ThemeProvider>
        </AuthKitProvider>
      </body>
    </html>
  )
}
