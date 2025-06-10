'use client'

import { authClient } from '@/lib/auth-client'
import React, { createContext, useContext } from 'react'

const SessionContext = createContext<ReturnType<typeof authClient.useSession> | undefined>(
  undefined,
)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession()
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
} 