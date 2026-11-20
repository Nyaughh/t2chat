import { authClient } from '@/lib/auth-client'

export type SocialProvider = 'github' | 'discord'

// Starts the OAuth flow. On success Better Auth navigates the browser to the
// provider; failures during the callback come back to /auth?error=<code>.
export const signInWithProvider = async (provider: SocialProvider) => {
  const { error } = await authClient.signIn.social({
    provider,
    callbackURL: '/',
    errorCallbackURL: '/auth',
  })
  if (error) {
    throw new Error(error.message || error.statusText || 'Sign-in failed')
  }
}
