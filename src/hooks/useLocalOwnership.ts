'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { authClient, useSession } from '@/lib/auth-client'
import { db } from '@/lib/dexie'
import { signingOutStore, syncLocalOwnership } from '@/lib/local-data'
import {
  localSessionKey,
  ownershipRetryDelayMs,
  sessionStateFrom,
  type LocalSessionState,
} from '@/lib/local-data-policy'

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
 * the signed-in one, are deleted. The sync re-runs whenever the ownership of
 * local rows changes, retries with backoff while the server can't confirm the
 * session, and retries on focus and reconnect. `signingOut` is true while an
 * explicit sign-out request is in flight.
 */
export function useLocalOwnership(): { session: LocalSessionState; signingOut: boolean } {
  const { data, isPending, error } = useSession()
  const raw = sessionStateFrom({ data, isPending, error })
  const key = localSessionKey(raw)
  // Stable object per identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const session = useMemo(() => raw, [key])
  const signingOut = useSyncExternalStore(signingOutStore.subscribe, signingOutStore.getSnapshot, () => false)

  // Ownership state of all local rows; a change re-runs the sync.
  const rowsKey = useLiveQuery(
    async () =>
      (await db.conversations.toArray())
        .map((c) => `${c.id}:${c.userId ?? ''}:${c.legacyOwner ? 1 : 0}`)
        .sort()
        .join('|'),
    [],
    '',
  )

  const [retryTick, setRetryTick] = useState(0)
  const attemptRef = useRef(0)
  useEffect(() => {
    attemptRef.current = 0
  }, [session])

  useEffect(() => {
    const bump = () => setRetryTick((t) => t + 1)
    window.addEventListener('focus', bump)
    window.addEventListener('online', bump)
    return () => {
      window.removeEventListener('focus', bump)
      window.removeEventListener('online', bump)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const retryLater = () => {
      if (cancelled) return
      timer = setTimeout(() => setRetryTick((t) => t + 1), ownershipRetryDelayMs(attemptRef.current++))
    }
    syncLocalOwnership(session, confirmSession).then(
      (outcome) => {
        if (outcome === 'unconfirmed') retryLater()
        else attemptRef.current = 0
      },
      (err) => {
        console.error('Failed to update local chat ownership:', err)
        retryLater()
      },
    )
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [session, rowsKey, retryTick])

  return { session, signingOut }
}
