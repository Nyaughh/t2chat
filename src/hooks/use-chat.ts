import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { Id } from '../../convex/_generated/dataModel'
import { Message } from '@/lib/types'
import { useRouter } from 'next/navigation'

const UNAUTHENTICATED_MESSAGE_LIMIT = 10
const FREE_TIER_MESSAGE_LIMIT = 20

// Common interface for both hooks
interface ChatHook {
  messages: Message[]
  isTyping: boolean
  handleSendMessage: (content: string, attachments?: File[]) => void
  editMessage: (messageId: Id<'messages'> | string, newContent: string) => void
  regenerateResponse: (messageId: Id<'messages'> | string) => void
  stopGeneratingResponse: () => void
  canSendMessage: boolean
  messageCount: number
  limit: number
}

export function useUnauthenticatedChat(): ChatHook {
  const localMessages = useLiveQuery(() => db.messages.toArray(), [])
  const [isTyping, setIsTyping] = useState(false)

  const messages = (localMessages?.map((msg) => ({
    ...msg,
    _id: msg.id,
    _creationTime: msg.timestamp,
  })) || []) as Message[]

  const messageCount = messages.length
  const canSendMessage = messageCount < UNAUTHENTICATED_MESSAGE_LIMIT

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      if (!canSendMessage) return

      const userMessage = {
        id: uuidv4(),
        content,
        role: 'user' as const,
        timestamp: new Date(),
        attachments: attachments?.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      }
      await db.messages.add(userMessage)

      setIsTyping(true)
      setTimeout(async () => {
        const botMessage = {
          id: uuidv4(),
          content: 'This is a simulated response. Sign in to continue.',
          role: 'assistant' as const,
          timestamp: new Date(),
        }
        await db.messages.add(botMessage)
        setIsTyping(false)
      }, 1000)
    },
    [canSendMessage],
  )

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    await db.messages.update(messageId, { content: newContent })
  }, [])

  const regenerateResponse = useCallback(
    (messageId: string) => {
      // Not implemented for unauthenticated
      console.log('Regenerate response not available for signed-out users.')
    },
    [],
  )

  const stopGeneratingResponse = useCallback(() => {
    // Not implemented for unauthenticated
    setIsTyping(false)
  }, [])

  return {
    messages,
    isTyping,
    handleSendMessage,
    editMessage,
    regenerateResponse,
    stopGeneratingResponse,
    canSendMessage,
    messageCount,
    limit: UNAUTHENTICATED_MESSAGE_LIMIT,
  }
}

export function useAuthenticatedChat({
  conversationId,
}: {
  conversationId?: Id<'conversations'>
}): ChatHook {
  const { user: workosUser } = useAuth()
  const router = useRouter()

  const convexUser = useQuery(
    api.users.getUserByWorkosId,
    workosUser ? { workosId: workosUser.id } : 'skip',
  )
  const userId = convexUser?._id

  const messages = useQuery(api.messages.listMessages, conversationId ? { conversationId } : 'skip') || []
  const addMessage = useMutation(api.messages.addMessage)
  const chatAction = useAction(api.messages.chat)
  const createConversationAndAddFirstMessage = useMutation(api.conversations.createAndAddFirstMessage)

  const [isTyping, setIsTyping] = useState(false)

  const credits = {
    count: convexUser?.credits ?? 0,
    limit: FREE_TIER_MESSAGE_LIMIT,
  }
  const canSendMessage = convexUser?.tier === 'Pro' || credits.count > 0

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      if (!userId || !canSendMessage) return

      if (conversationId) {
        // Existing conversation
        await addMessage({ conversationId, content, role: 'user' })
        setIsTyping(true)
        try {
          await chatAction({ userId, conversationId, message: content })
        } catch (error) {
          console.error('Error sending message:', error)
        } finally {
          setIsTyping(false)
        }
      } else {
        // New conversation
        const newConvId = await createConversationAndAddFirstMessage({ userId, content })
        if (newConvId) {
          router.push(`/chat/${newConvId}`)
        }
      }
    },
    [
      userId,
      canSendMessage,
      conversationId,
      addMessage,
      chatAction,
      createConversationAndAddFirstMessage,
      router,
    ],
  )

  const editMessage = useCallback(
    (messageId: Id<'messages'> | string, newContent: string) => {
      console.log('Edit message not yet implemented for authenticated users.')
      // await editMessageMutation({ messageId, newContent });
    },
    [],
  )

  const regenerateResponse = useCallback(
    (messageId: Id<'messages'> | string) => {
      console.log('Regenerate response not yet implemented for authenticated users.')
      // await regenerateResponseMutation({ messageId });
    },
    [],
  )

  const stopGeneratingResponse = useCallback(() => {
    console.log('Stop generating not yet implemented for authenticated users.')
    // await stopGeneratingMutation();
    setIsTyping(false)
  }, [])

  return {
    messages: messages as Message[],
    isTyping,
    handleSendMessage,
    editMessage,
    regenerateResponse,
    stopGeneratingResponse,
    canSendMessage,
    messageCount: credits.count,
    limit: credits.limit,
  }
} 