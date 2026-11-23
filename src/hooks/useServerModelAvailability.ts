import { useEffect, useState, useSyncExternalStore } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { ServerModelAvailability } from '@/lib/serverQuota'

const REFRESH_MS = 60_000

// Guests: one shared poller of /api/models/availability for every component that asks.
let guestAvailability: ServerModelAvailability | undefined
const guestListeners = new Set<() => void>()
let guestTimer: ReturnType<typeof setInterval> | undefined

const refreshGuestAvailability = async () => {
  try {
    const response = await fetch('/api/models/availability', { cache: 'no-store' })
    if (!response.ok) return
    guestAvailability = (await response.json()) as ServerModelAvailability
    guestListeners.forEach((listener) => listener())
  } catch {
    // Keep the last answer; the server still enforces the limits
  }
}

const subscribeGuest = (listener: () => void) => {
  guestListeners.add(listener)
  if (!guestTimer) {
    void refreshGuestAvailability()
    guestTimer = setInterval(refreshGuestAvailability, REFRESH_MS)
  }
  return () => {
    guestListeners.delete(listener)
    if (guestListeners.size === 0 && guestTimer) {
      clearInterval(guestTimer)
      guestTimer = undefined
    }
  }
}
const noopSubscribe = () => () => {}
const readGuest = () => guestAvailability
const readNothing = () => undefined

/** A minute counter, so the Convex query re-runs and sees cooldowns and daily windows expire. */
function useMinute() {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / REFRESH_MS))
  useEffect(() => {
    const timer = setInterval(() => setMinute(Math.floor(Date.now() / REFRESH_MS)), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])
  return minute
}

/**
 * Which free (server-key) models can be used right now. Signed-in users read Convex (their limits,
 * Convex's keys); guests read /api/models/availability (their IP's limits, this server's keys).
 * `undefined` while loading.
 */
export function useServerModelAvailability(): ServerModelAvailability | undefined {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const minute = useMinute()
  const signedIn = useQuery(api.serverQuota.getServerModelAvailability, isAuthenticated ? { minute } : 'skip')
  const isGuest = !isLoading && !isAuthenticated
  const guest = useSyncExternalStore(isGuest ? subscribeGuest : noopSubscribe, readGuest, readNothing)
  if (isLoading) return undefined
  return isAuthenticated ? (signedIn ?? undefined) : guest
}
