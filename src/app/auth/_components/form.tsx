'use client'

import { useState, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Github, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signInWithProvider, type SocialProvider } from './authAction'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

const providers: { id: SocialProvider; label: string; icon: ReactNode }[] = [
  { id: 'github', label: 'Continue with GitHub', icon: <Github className="h-[18px] w-[18px]" /> },
  { id: 'discord', label: 'Continue with Discord', icon: <DiscordIcon className="h-[18px] w-[18px]" /> },
]

export default function SignInForm({ initialError }: { initialError?: string }) {
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | undefined>(initialError)

  const handleSignIn = async (provider: SocialProvider) => {
    setError(undefined)
    setPending(provider)
    try {
      await signInWithProvider(provider)
      // The browser is being redirected to the provider; keep the pending state.
    } catch (err) {
      setPending(null)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="space-y-3">
      {providers.map(({ id, label, icon }) => {
        const isPending = pending === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleSignIn(id)}
            disabled={pending !== null}
            aria-busy={isPending}
            className={cn(
              'group relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-xl px-4 cursor-pointer',
              'bg-white/80 dark:bg-white/[0.04] border border-rose-500/15 dark:border-white/10',
              'text-sm font-medium text-black/80 dark:text-white/85',
              'shadow-sm shadow-rose-500/5 dark:shadow-black/20',
              'transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]',
              'hover:border-rose-500/30 dark:hover:border-rose-300/25 hover:shadow-md hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10',
              'hover:text-rose-600 dark:hover:text-rose-300',
              'focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:focus-visible:ring-rose-300/40',
              'disabled:cursor-not-allowed disabled:opacity-60',
              isPending && 'disabled:opacity-100 border-rose-500/30 dark:border-rose-300/25',
            )}
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/[0.06] to-rose-500/0 dark:via-rose-300/[0.06] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/[0.07] text-rose-600 dark:bg-rose-300/10 dark:text-rose-300">
              {icon}
            </span>
            <span className="relative flex-1 text-left">{isPending ? 'Redirecting…' : label}</span>
            <span className="relative flex h-4 w-4 items-center justify-center text-black/30 dark:text-white/30 group-hover:text-rose-500 dark:group-hover:text-rose-300">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-500 dark:text-rose-300" />
              ) : (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </span>
          </button>
        )
      })}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3.5 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
