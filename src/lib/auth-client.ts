import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

// Auth requests go to this app's own origin (/api/auth/*), which proxies them
// to the Convex deployment. Using the current origin keeps the OAuth state
// cookie and session cookie on the same host the user signed in from.
export const authClient = createAuthClient({
  plugins: [convexClient()],
})

export const { useSession, signIn, signOut } = authClient
