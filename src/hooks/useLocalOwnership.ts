'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { authClient, useSession } from '@/lib/auth-client'
import { signingOutStore, syncLocalOwnership } from '@/lib/local-data'
import { localSessionKey, sessionStateFrom, type LocalSessionState } from '@/lib/local-data-policy'

// Asks the server for the session again before any local chat is deleted or
// claimed, so a stale in-memory session never changes ownership.
const confirmSession = async (): Promise<LocalSessionState> => {
  try {
    const result = await authClient.getSession()
    return sessionStateFrom({ data: result.data, error: result.error })
  } catch {
    return { status: 'unknown' }
  }
}

/**
 * The Better Auth session as a verified identity, and the guard that keeps the
 * local (guest) chats in IndexedDB in line with it: unowned chats are claimed by
 * the signed-in user, and chats of an account whose session ended, or that isn't
 * the signed-in one, are deleted. `signingOut` is true while an explicit
 * sign-out request is in flight.
 */
export function useLocalOwnership(): { session: LocalSessionState; signingOut: boolean } {
  const { data, isPending, error } = useSession()
  const raw = sessionStateFrom({ data, isPending, error })
  const key = localSessionKey(raw)
  // Stable object per identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const session = useMemo(() => raw, [key])
  const signingOut = useSyncExternalStore(signingOutStore.subscribe, signingOutStore.getSnapshot, () => false)

  useEffect(() => {
    syncLocalOwnership(session, confirmSession).catch((err) => {
      console.error('Failed to update local chat ownership:', err)
    })
  }, [session])

  return { session, signingOut }
}
