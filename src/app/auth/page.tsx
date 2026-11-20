import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Cloud, KeyRound, Mic } from 'lucide-react'
import { fetchQuery } from 'convex/nextjs'
import { getToken } from '@convex-dev/better-auth/nextjs'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import { api } from '../../../convex/_generated/api'
import { createAuth } from '../../../convex/auth'
import SignInForm from './_components/form'

export const metadata: Metadata = {
  title: 'Sign in · T2Chat',
}

// Better Auth redirects back here with ?error=<code> when the OAuth callback fails.
const errorMessages: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. Pick a provider to try again.',
  state_mismatch: 'Your sign-in session expired. Please try again.',
  please_restart_the_process: 'Your sign-in session expired. Please try again.',
  invalid_code: 'The provider rejected the sign-in. Please try again.',
  email_not_found:
    'Your account has no email address we can use. Add a verified email with the provider and try again.',
  unable_to_get_user_info: "We couldn't read your profile from the provider. Please try again.",
}

function describeError(code?: string) {
  if (!code) return undefined
  return errorMessages[code] ?? 'Sign-in failed. Please try again.'
}

async function isSignedIn() {
  try {
    const token = await getToken(createAuth)
    if (!token) return false
    const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })
    return !!user
  } catch {
    return false
  }
}

const perks = [
  { icon: Cloud, label: 'Chats synced across devices' },
  { icon: KeyRound, label: 'Bring your own API keys' },
  { icon: Mic, label: 'Voice chat and file uploads' },
]

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await isSignedIn()) {
    redirect('/')
  }

  const { error } = await searchParams
  const initialError = describeError(Array.isArray(error) ? error[0] : error)

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-background to-rose-50/60 dark:from-[oklch(0.15_0.02_25)] dark:via-[oklch(0.17_0.015_25)] dark:to-[oklch(0.15_0.02_25)]" />
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-rose-300/25 blur-3xl dark:bg-rose-500/10" />
        <div className="absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-rose-400/15 blur-3xl dark:bg-rose-400/[0.06]" />
        <div className="absolute -bottom-24 -left-32 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-300/[0.04]" />
        <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15] [background-image:radial-gradient(oklch(0.6_0.08_15/0.25)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-2.5">
        <Link
          href="/"
          className="group flex items-center gap-1.5 rounded-lg border border-rose-500/10 bg-white/70 px-2.5 py-2 text-sm text-rose-600 shadow-lg shadow-rose-500/5 backdrop-blur-xl transition-colors hover:border-rose-500/20 hover:text-rose-700 dark:border-white/10 dark:bg-[oklch(0.18_0.015_25)]/30 dark:text-rose-300 dark:shadow-black/20 dark:hover:border-rose-300/20 dark:hover:text-rose-200"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="pr-0.5">Back to chat</span>
        </Link>
        <div className="flex items-center rounded-lg border border-rose-500/10 bg-white/70 p-2 shadow-lg shadow-rose-500/5 backdrop-blur-xl dark:border-white/10 dark:bg-[oklch(0.18_0.015_25)]/30 dark:shadow-black/20">
          <ThemeSwitcher />
        </div>
      </div>

      <main className="relative flex min-h-dvh items-center justify-center px-4 py-20">
        <div className="w-full max-w-[400px]">
          <div className="relative rounded-2xl border border-rose-500/10 bg-white/75 p-7 shadow-2xl shadow-rose-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-[oklch(0.18_0.015_25)]/60 dark:shadow-black/40 sm:p-8">
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/[0.04] via-transparent to-rose-500/[0.07] dark:from-rose-500/[0.06] dark:to-rose-500/[0.1]" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent dark:via-rose-300/30" />

            <div className="relative">
              <div className="mb-7 flex flex-col items-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02] shadow-inner dark:border-rose-300/15 dark:from-rose-300/15 dark:to-rose-300/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon.svg" alt="" width={30} height={30} />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-black/85 dark:text-white/90">
                  Welcome to{' '}
                  <span className="bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 bg-clip-text text-transparent dark:from-rose-300 dark:via-rose-200 dark:to-rose-300">
                    T2Chat
                  </span>
                </h1>
                <p className="mt-2 text-sm text-black/55 dark:text-white/55">
                  Sign in to save your conversations and pick up where you left off.
                </p>
              </div>

              <SignInForm initialError={initialError} />

              <div className="my-6 h-px bg-gradient-to-r from-transparent via-rose-500/15 to-transparent dark:via-white/10" />

              <ul className="space-y-2.5">
                {perks.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm text-black/60 dark:text-white/60">
                    <Icon className="h-4 w-4 flex-shrink-0 text-rose-500/80 dark:text-rose-300/80" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 px-6 text-center text-xs leading-relaxed text-black/45 dark:text-white/40">
            We only use your name, email and avatar from the provider to create your account.
          </p>
        </div>
      </main>
    </div>
  )
}
