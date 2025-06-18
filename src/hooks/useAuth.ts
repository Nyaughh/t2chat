'use client'

import { useSession } from '@/lib/auth-client'
import { useMemo } from 'react'
import { UserMetadata } from '@/lib/types'

interface UseAuthOptions {
  serverIsSignedIn?: boolean
  serverUserMetadata?: UserMetadata
}

export function useAuth(options: UseAuthOptions = {}) {
  const { serverIsSignedIn, serverUserMetadata } = options
  const { data: session, isPending, error } = useSession()

  const isSignedIn = useMemo(() => {
    if (isPending) return serverIsSignedIn ?? false
    return !!session?.user
  }, [session?.user, isPending, serverIsSignedIn])

  const userMetadata = useMemo((): UserMetadata => {
    if (isPending && serverUserMetadata) return serverUserMetadata

    if (session?.user) {
      return {
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
        image: session.user.image ?? undefined,
      }
    }

    return serverUserMetadata ?? { name: undefined, email: undefined, image: undefined }
  }, [session?.user, isPending, serverUserMetadata])

  return {
    isSignedIn,
    userMetadata,
    isPending,
    error,
    user: session?.user,
  }
}
