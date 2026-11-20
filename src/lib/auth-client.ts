import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

// Auth requests go to this app's own origin (/api/auth/*), which proxies them
// to the Convex deployment. Using the current origin keeps the OAuth state
// cookie and session cookie on the same host the user signed in from.
export const authClient = createAuthClient({
  plugins: [convexClient()],
})

export const { useSession, signIn, signOut } = authClient

/**
 * Sign out and wipe this browser's local chats first, so the next person on a
 * shared browser can't see them (audit S7). Use this instead of `signOut`.
 * Takes the same arguments as `authClient.signOut`.
 */
export async function signOutAndClear(...args: Parameters<typeof authClient.signOut>) {
  // Loaded lazily so this module doesn't pull IndexedDB code into every importer.
  const { releaseLocalData } = await import('./local-data')
  try {
    await releaseLocalData()
  } catch (error) {
    // Still sign out. The session guard retries the wipe and keeps local chats
    // hidden until it succeeds.
    console.error('Failed to clear local chats before sign-out:', error)
  }
  return authClient.signOut(...args)
}
