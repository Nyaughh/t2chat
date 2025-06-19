import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline - T2Chat',
  description: 'You are currently offline. Please check your internet connection.',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto text-center px-6">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <svg
              className="w-12 h-12 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25A9.75 9.75 0 002.25 12c0 5.385 4.365 9.75 9.75 9.75s9.75-4.365 9.75-9.75A9.75 9.75 0 0012 2.25z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            You're Offline
          </h1>
          <p className="text-muted-foreground mb-6">
            It looks like you've lost your internet connection. Check your network settings and try again.
          </p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="w-full bg-muted text-muted-foreground px-4 py-2 rounded-md hover:bg-muted/80 transition-colors"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-8 text-sm text-muted-foreground">
          <p>Once you're back online, you can continue using T2Chat normally.</p>
        </div>
      </div>
    </div>
  )
} 