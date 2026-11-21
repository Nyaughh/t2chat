'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { fromLegacySettings, sanitizeAppearance, APPEARANCE_STORAGE_KEY, type Appearance } from '@/lib/theme/appearance'
import {
  applyAppearance,
  getAppearanceSnapshot,
  getServerAppearanceSnapshot,
  reloadFromStorage,
  setAppearance,
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
 * - localStorage on every device (guests included; also read by the pre-paint boot script),
 * - Convex for signed-in users, newest `updatedAt` wins.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  // Re-apply on mount: the boot script's snapshot may predate this build.
  useEffect(() => {
    applyAppearance(getAppearanceSnapshot())
    const onStorage = (e: StorageEvent) => {
      if (e.key === APPEARANCE_STORAGE_KEY) reloadFromStorage()
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
  const { isAuthenticated } = useConvexAuth()
  const remote = useQuery(api.appearance.getAppearance, isAuthenticated ? {} : 'skip')
  const save = useMutation(api.appearance.updateAppearance)
  /** `updatedAt` of the copy we know the server has, so we don't echo it back. */
  const syncedAt = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reconcile with the server copy whenever it changes.
  useEffect(() => {
    if (!isAuthenticated || remote === undefined) return
    const local = getAppearanceSnapshot()
    const server = remote?.appearance ? sanitizeAppearance(remote.appearance) : null

    if (server && server.updatedAt >= local.updatedAt) {
      syncedAt.current = server.updatedAt
      if (server.updatedAt > local.updatedAt) setAppearance(server)
      return
    }
    if (!server && local.updatedAt === 0) {
      // Never customized anywhere: carry over the old font settings, if any.
      const legacy = fromLegacySettings(remote?.legacy.mainFont, remote?.legacy.codeFont)
      if (Object.keys(legacy).length) updateAppearance(legacy)
      return
    }
    // This device has newer changes than the server (e.g. made while signed out).
    syncedAt.current = server?.updatedAt ?? null
    if (local.updatedAt > 0) {
      save({ appearance: local }).then(
        () => (syncedAt.current = local.updatedAt),
        (err) => console.error('Failed to save appearance', err),
      )
    }
  }, [isAuthenticated, remote, save])

  // Push local changes to the server, debounced.
  useEffect(() => {
    if (!isAuthenticated) return
    const unsubscribe = subscribeAppearance(() => {
      const next = getAppearanceSnapshot()
      if (next.updatedAt === 0 || next.updatedAt === syncedAt.current) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const latest = getAppearanceSnapshot()
        save({ appearance: latest }).then(
          () => (syncedAt.current = latest.updatedAt),
          (err) => console.error('Failed to save appearance', err),
        )
      }, SAVE_DELAY_MS)
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [isAuthenticated, save])

  return null
}
