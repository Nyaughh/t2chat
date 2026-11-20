'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { syncLocalDataOwner } from '@/lib/local-data'
import { localSessionKey, type LocalSessionState } from '@/lib/local-data-policy'

/**
 * Enforces local chat ownership for the current session and reports whether
 * the chats in IndexedDB may be shown. `visible` stays false until the check
 * for the current session has finished, so a previous user's local chats are
 * never rendered while they are being wiped. `signedIn` is true while the auth
 * session (not Convex) says a user is signed in.
 */
export function useLocalDataVisible(): { visible: boolean; signedIn: boolean } {
  const { data, isPending, error } = useSession()
  const userId = data?.user?.id ?? null

  const session: LocalSessionState = isPending
    ? { status: 'pending' }
    : error
      ? { status: 'unknown' }
      : userId
        ? { status: 'signed-in', userId }
        : { status: 'signed-out' }
  const key = localSessionKey(session)

  const [result, setResult] = useState<{ key: string; visible: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    const current: LocalSessionState =
      session.status === 'signed-in' ? { status: 'signed-in', userId: session.userId } : { status: session.status }
    syncLocalDataOwner(current).then(
      (visible) => {
        if (!cancelled) setResult({ key, visible })
      },
      (err) => {
        console.error('Failed to clear local chats from a previous session:', err)
        if (!cancelled) setResult({ key, visible: false })
      },
    )
    return () => {
      cancelled = true
    }
    // `key` fully describes `session`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { visible: result?.key === key && result.visible, signedIn: session.status === 'signed-in' }
}
