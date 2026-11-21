'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

/**
 * Sign out from any entry point (settings dialog, sidebar profile menu) the same way.
 *
 * Deliberately a plain `authClient.signOut`: local chats are not wiped here. Clearing
 * browser data on sign-out belongs to the app's ownership-aware local-data handling,
 * which only removes rows the signed-out user claimed, never other tabs' or unclaimed data.
 */
export function useSignOut(onSignedOut?: () => void) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signOut = useCallback(async () => {
    setIsSigningOut(true)
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            onSignedOut?.()
            router.refresh()
          },
          onError: () => {
            toast.error('Could not sign out. Please try again.')
          },
        },
      })
    } finally {
      setIsSigningOut(false)
    }
  }, [onSignedOut, router])

  return { signOut, isSigningOut }
}
