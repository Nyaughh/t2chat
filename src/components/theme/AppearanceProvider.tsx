'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Appearance } from '@/lib/theme/appearance'
import {
  APPEARANCE_STORAGE_KEYS,
  applyInitialAppearance,
  getActiveOwner,
  getAppearanceSnapshot,
  getServerAppearanceSnapshot,
  reconcileAccount,
  reloadFromStorage,
  showAccount,
  showGuest,
  subscribeAppearance,
  updateAppearance,
} from '@/lib/theme/store'

/** Current appearance preferences, and a setter that applies + persists them. */
export function useAppearance(): [Appearance, typeof updateAppearance] {
  const appearance = useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getServerAppearanceSnapshot)
  return [appearance, updateAppearance]
}

const SAVE_DELAY_MS = 600

/**
 * Applies appearance preferences app-wide and keeps them in sync:
 * - localStorage on every device (also read by the pre-paint boot script),
 * - Convex for signed-in users, scoped to the account that owns each copy.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  // Initialize the hydrated store with the same selection used for first paint.
  useEffect(() => {
    applyInitialAppearance()
    const onStorage = (e: StorageEvent) => {
      if (e.key && APPEARANCE_STORAGE_KEYS.includes(e.key)) reloadFromStorage()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <>
      {children}
      {/* Account sync is best-effort: if it fails, appearance still works from this device. */}
      <ErrorBoundary fallback={null} onError={(err) => console.error('Appearance sync disabled', err)}>
        <AppearanceSync />
      </ErrorBoundary>
    </>
  )
}

function AppearanceSync() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const remote = useQuery(api.appearance.getAppearance, isAuthenticated ? {} : 'skip')
  const save = useMutation(api.appearance.updateAppearance)
  /** Which account the active copy was reconciled for, and the `updatedAt` its server copy has. */
  const synced = useRef<{ owner: string; at: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signedIn = useRef(false)
  signedIn.current = isAuthenticated

  const cancelPending = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const push = (owner: string, appearance: Appearance) => {
    save({ owner, appearance }).then(
      () => {
        if (synced.current?.owner === owner) synced.current = { owner, at: appearance.updatedAt }
      },
      (err) => console.error('Failed to save appearance', err),
    )
  }

  // Signed out (including logout without a page reload): back to the guest copy,
  // and drop any save still queued for the previous account.
  useEffect(() => {
    if (isLoading || isAuthenticated) return
    cancelPending()
    synced.current = null
    showGuest()
  }, [isLoading, isAuthenticated])

  // Signed in: reconcile this account's server copy with the device's copy for
  // the same account. Another account's cached copy is replaced, never pushed.
  useEffect(() => {
    if (!isAuthenticated || !remote) return
    const { userId } = remote
    if (synced.current?.owner !== userId) cancelPending()
    const result = reconcileAccount(remote)
    synced.current = { owner: userId, at: result.push ? -1 : result.appearance.updatedAt }
    showAccount(userId, result.appearance)
    if (result.push) push(userId, result.appearance)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, remote])

  // Push edits to the active account's copy, debounced, to that account only.
  useEffect(() => {
    const unsubscribe = subscribeAppearance(() => {
      const owner = getActiveOwner()
      const next = getAppearanceSnapshot()
      if (!owner || !signedIn.current || synced.current?.owner !== owner) return
      if (next.updatedAt === 0 || next.updatedAt === synced.current.at) return
      cancelPending()
      timer.current = setTimeout(() => {
        timer.current = null
        if (!signedIn.current || getActiveOwner() !== owner || synced.current?.owner !== owner) return
        push(owner, getAppearanceSnapshot())
      }, SAVE_DELAY_MS)
    })
    return () => {
      unsubscribe()
      cancelPending()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
