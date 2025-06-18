'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'

function ChatErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const router = useRouter()

  useEffect(() => {
    if (error.message.includes('ArgumentValidationError')) {
      router.push('/')
    }
  }, [error, router])

  if (error.message.includes('ArgumentValidationError')) {
    return <div>Invalid chat. Redirecting...</div>
  }

  // You can render any custom fallback UI for other errors
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

export function ChatErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ChatErrorFallback}
      onReset={() => {
        // Maybe redirect home here as well, or attempt to refetch.
        // For now, this is fine.
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
