import SignInForm from "./_components/form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50 dark:from-[oklch(0.15_0.02_25)] dark:via-[oklch(0.18_0.015_25)] dark:to-[oklch(0.15_0.02_25)] flex items-center justify-center p-4">
      {/* Back button */}
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20">
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
          <p className="text-black/60 dark:text-white/60 text-lg">
            Sign in to continue your conversations.
          </p>
        </div>

        {/* Auth card */}
        <div className="relative">
          {/* Premium background with glass effect */}
          <div className="bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 rounded-2xl shadow-2xl shadow-rose-500/10 dark:shadow-black/20 p-8">
            {/* Gradient overlays for premium look */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-2xl"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-2xl"></div>

            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-black/80 dark:text-white/80 mb-6 text-center">
                Choose your sign-in method
              </h2>
              
              <SignInForm />
              
              <div className="mt-6 text-center">
                <p className="text-xs text-black/50 dark:text-white/50">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>

            {/* Premium glow effect */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-2xl blur-xl opacity-0 dark:opacity-20 pointer-events-none"></div>
          </div>
        </div>


      </div>
    </div>
  )
}