import ChatInterface from '@/app/(chat)/_components/ChatInterface'
import { api } from '../../../../convex/_generated/api'
import { fetchQuery } from "convex/nextjs";
import { createAuth } from '../../../../convex/auth'
import { getToken } from "@convex-dev/better-auth/nextjs";
import { Id } from '../../../../convex/_generated/dataModel'
import { ConvexMessage } from '@/lib/types'

interface ChatPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params
  const token = await getToken(createAuth); 
  const user = await fetchQuery(api.auth.getCurrentUser, {}, { token })

  // Fetch initial messages server-side if user is authenticated and we have a valid chat ID
  let initialMessages: ConvexMessage[] | null = null
  if (user && token && id) {
    try {
      // Validate that the chat ID is a valid Convex ID format
      const chatId = id as Id<"chats">
      initialMessages = await fetchQuery(api.chat.queries.getChatMessages, { chatId }, { token })
    } catch (error) {
      console.warn('Failed to fetch initial messages for chat:', id, error)
      initialMessages = []
    }
  }

  return <ChatInterface chatId={id} initialMessages={initialMessages} />
}
