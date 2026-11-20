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
 * Sign out, then delete the local chats the signed-in user claimed, so the next
 * person on a shared browser can't see them (audit S7). They are hidden while
 * the request runs and kept if it fails, since the user is then still signed in
 * and may not have imported them yet. Takes the same arguments as
 * `authClient.signOut`.
 *
 * Plain `authClient.signOut` is safe too: the session guard in
 * useLocalOwnership deletes the claimed chats once the server confirms the
 * session ended. This wrapper also hides them during the request.
 */
export async function signOutAndClear(...args: Parameters<typeof authClient.signOut>) {
  // Loaded lazily so this module doesn't pull IndexedDB code into every importer.
  const { signingOutStore, wipeClaimedLocalData } = await import('./local-data')
  signingOutStore.begin()
  try {
    const result = await authClient.signOut(...args)
    if (!result?.error) {
      await wipeClaimedLocalData().catch((error) => {
        // The session guard retries once it sees the signed-out session.
        console.error('Failed to clear local chats after sign-out:', error)
      })
    }
    return result
  } finally {
    signingOutStore.end()
  }
}
