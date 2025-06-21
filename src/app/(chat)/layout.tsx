import ChatLayout from '@/app/(chat)/_components/ChatLayout'
import { headers } from 'next/headers'
import { api } from '../../../convex/_generated/api'
import { fetchQuery } from 'convex/nextjs'
import { createAuth } from '../../../convex/auth'
import { getToken } from '@convex-dev/better-auth/nextjs'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  let user = null
  let initialChats = null
  let token = null

  try {
    // Try to get auth token and user data
    token = await getToken(createAuth)
    
    if (token) {
      user = await fetchQuery(api.auth.getCurrentUser, {}, { token })
      
      // Only fetch chats if user is authenticated
      if (user) {
        initialChats = await fetchQuery(api.chat.queries.getUserChats, {}, { token })
      }
    }
  } catch (error) {
    // Handle offline or network errors gracefully
    console.warn('[ChatLayout] Failed to fetch initial data (likely offline):', error)
    // user and initialChats remain null, which is handled by the client components
  }

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
    </div>
  )
}
