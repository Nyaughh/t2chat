import SignInForm from './_components/form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50 dark:from-[oklch(0.15_0.02_25)] dark:via-[oklch(0.18_0.015_25)] dark:to-[oklch(0.15_0.02_25)] flex items-center justify-center p-4">
      {/* Back button */}
      <Link href="/" className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20"
        >
          <ArrowLeft className="h-4 w-4 text-rose-600 dark:text-rose-300" />
        </Button>
      </Link>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-rose-300/10 dark:bg-rose-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-400/10 dark:bg-rose-400/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-200/10 dark:bg-rose-300/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none mb-2">
            T2Chat
          </h1>
          <p className="text-black/60 dark:text-white/60 text-lg">Sign in to continue your conversations.</p>
        </div>

        <SignInForm />

        <div className="mt-6 text-center">
          <p className="text-xs text-black/50 dark:text-white/50">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
