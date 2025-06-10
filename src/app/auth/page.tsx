'use client'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Github } from 'lucide-react'

export default function AuthPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-8 bg-card text-card-foreground rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to T2Chat</h1>
          <p className="mt-2 text-muted-foreground">Sign in to continue</p>
        </div>
        <Button
          onClick={() => authClient.signIn.social({ provider: 'github' })}
          className="w-full h-12 text-base font-semibold"
          variant="outline"
        >
          <Github className="w-5 h-5 mr-3" />
          Sign in with GitHub
        </Button>
      </div>
    </div>
  )
} 