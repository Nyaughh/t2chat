import ChatLayout from '@/app/(chat)/_components/ChatLayout'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { headers } from 'next/headers'
import { api } from '../../../convex/_generated/api'
import { fetchQuery } from 'convex/nextjs'
import { createAuth } from '../../../convex/auth'
import { getToken } from '@convex-dev/better-auth/nextjs'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  const token = await getToken(createAuth)
  const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })

  // Fetch initial chats if user is authenticated to prevent flash
  const initialChats = user ? await fetchQuery(api.chat.queries.getUserChats, {}, { token }) : null

  const userMetadata = {
    name: user?.name,
    email: user?.email,
    image: user?.image,
  }

  return (
    <div>
      <ChatLayout userMetadata={userMetadata} isSignedIn={!!user} initialChats={initialChats}>
        {children}
      </ChatLayout>
      <PWAInstallPrompt />
    </div>
  )
}
