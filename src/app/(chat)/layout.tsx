import ChatLayout from '@/app/(chat)/_components/ChatLayout'
import { headers } from 'next/headers'
import { api } from '../../../convex/_generated/api'
import { fetchQuery } from "convex/nextjs";
import { createAuth } from '../../../convex/auth'
import { getToken } from "@convex-dev/better-auth/nextjs";
import { ConvexChat } from '@/lib/types'

export default async function ChatLayoutPage({ children }: { children: React.ReactNode }) {
  const token = await getToken(createAuth); 
  const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })

  // Fetch initial chats server-side if user is authenticated
  let initialChats: ConvexChat[] | null = null
  if (user && token) {
    try {
      initialChats = await fetchQuery(api.chat.queries.getUserChats, {}, { token })
    } catch (error) {
      console.warn('Failed to fetch initial chats:', error)
      initialChats = []
    }
  }

  const userMetadata = {
    name: user?.name,
    email: user?.email,
    image: user?.image,
  }

  return (
    <div>
      <ChatLayout 
        userMetadata={userMetadata} 
        isSignedIn={!!user}
        initialChats={initialChats}
      >
        {children}
      </ChatLayout>
    </div>
  )
}
