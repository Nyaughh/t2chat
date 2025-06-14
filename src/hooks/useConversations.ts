'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { db, type Conversation as DBConversation, type DBMessage } from '../lib/dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { useConvexChat } from './use-convex-chat'
import { models, type ModelInfo } from '@/lib/models'
import type { ClientMessage, Attachment } from '@/lib/types'
import type { Id } from '../../convex/_generated/dataModel'
import { parseDataStream } from '@/lib/stream-parser'
import { CoreMessage } from 'ai'

export const useConversations = () => {

  const router = useRouter()
  const pathname = usePathname()
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(models[0])

  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isStreaming: isConvexStreaming,
    messages: convexMessages,
    chats: convexChats,
    createChat,
    sendMessage,
    retryMessage,
    deleteChat: deleteConvexChat,
    deleteMessagesFromIndex,
  } = useConvexChat(currentChatId as Id<"chats"> | undefined)

  const dexieConversations = useLiveQuery(() => db.conversations.orderBy('lastMessageAt').reverse().toArray(), [])
  const liveLocalMessages = useLiveQuery(
    () => {
      if (!currentChatId || isAuthenticated) return [];
      return db.messages.where('conversationId').equals(currentChatId).sortBy('createdAt');
    },
    [currentChatId, isAuthenticated],
    []
  )
  const [isLocalStreaming, setIsLocalStreaming] = useState(false)

  const activeMessages = useMemo(() => {
    if (isAuthLoading) return [];
    if (isAuthenticated) {
      return (convexMessages || []).map(msg => ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        modelId: msg.modelId,
        thinking: msg.thinking,
        thinkingDuration: msg.thinkingDuration,
        attachments: msg.attachments,
        createdAt: new Date(msg.createdAt),
      } as ClientMessage & { modelId: string; attachments?: any[] }))
    }
    return liveLocalMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      modelId: msg.model,
      thinking: msg.thinking,
      thinkingDuration: msg.thinkingDuration,
      attachments: msg.attachments,
      createdAt: new Date(msg.createdAt),
    } as ClientMessage & { modelId: string; attachments?: any[] }))
  }, [isAuthLoading, isAuthenticated, convexMessages, liveLocalMessages])

  const activeChats = useMemo(() => {
    if (isAuthLoading) {
      return []
    }
    if (isAuthenticated) {
      return (convexChats || []).map(chat => ({
        id: chat._id,
        title: chat.title || "New Chat",
        createdAt: new Date(chat.createdAt),
        lastMessageAt: new Date(chat.updatedAt),
      }))
    }
    return dexieConversations || []
  }, [isAuthLoading, isAuthenticated, convexChats, dexieConversations])

  const currentConversation = useMemo(
    () => dexieConversations?.find((conv) => conv.id === currentChatId),
    [dexieConversations, currentChatId],
  )

  const abortControllerRef = useRef<AbortController | null>(null)

  const handleNewMessage = useCallback(async (
    input: string,
    options?: {
      attachments?: Attachment[];
      modelId?: string;
      webSearch?: boolean;
    }
  ) => {
    if (isAuthenticated) {
      let chatId = currentChatId as Id<"chats">
      if (!chatId) {
        const newChatId = await createChat({ title: input.substring(0, 50) })
        chatId = newChatId
        router.push(`/chat/${newChatId}`)
      }
      await sendMessage({ 
        chatId, 
        message: input, 
        modelId: options?.modelId || selectedModel.id,
        attachments: options?.attachments,
        webSearch: options?.webSearch,
      })
    } else {
      setIsLocalStreaming(true)
      console.log("message", input)
      abortControllerRef.current = new AbortController()
      let conversationId = currentChatId

      const userMessage: DBMessage = {
        id: uuidv4(),
        conversationId: '',
        content: input,
        role: 'user',
        createdAt: new Date(),
        model: selectedModel.id,
        parts: [],
      }
      
      if (!conversationId) {
        conversationId = uuidv4()
        userMessage.conversationId = conversationId
        const newConv: DBConversation = {
          id: conversationId,
          title: input.split(' ').slice(0, 4).join(' '),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMessageAt: new Date(),
        }
        const newConvId = await db.conversations.add(newConv)
        console.log("newConvId", newConvId)
      router.push(`/chat/${conversationId}`)
      } else {
        userMessage.conversationId = conversationId
      }
      
      await db.messages.add(userMessage)

      const history = [...liveLocalMessages, userMessage]
      const coreHistory: CoreMessage[] = history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      
      try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: coreHistory,
            data: { modelId: selectedModel.id },
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.body) throw new Error('No response body')

      const assistantId = uuidv4()
        const assistantMessage: DBMessage = {
          id: assistantId,
          conversationId,
          content: '',
          role: 'assistant',
          createdAt: new Date(),
          model: selectedModel.id,
          parts: [],
        }
        await db.messages.add(assistantMessage)

      const dataStream = parseDataStream(response.body)
        let streamingContent = ''
        let streamingThinking = ''
        let finalThinkingDuration: number | undefined

      for await (const chunk of dataStream) {
          if (abortControllerRef.current?.signal.aborted) break
          if (chunk.type === 'text') {
            streamingContent += chunk.value
            await db.messages.update(assistantId, { content: streamingContent })
          } else if (chunk.type === 'reasoning') {
            streamingThinking += chunk.value
            await db.messages.update(assistantId, { 
                    content: streamingContent,
              thinking: streamingThinking 
            })
          } else if (chunk.type === 'finish') {
            finalThinkingDuration = chunk.value?.thinkingDuration
            await db.messages.update(assistantId, { 
        content: streamingContent,
              thinking: streamingThinking || undefined,
              thinkingDuration: finalThinkingDuration
            })
          }
        }
        
        if (!streamingContent.trim()) {
          await db.messages.delete(assistantId)
      }

    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error("Error in local stream:", error)
          toast.error("An error occurred while getting the response.")
        }
    } finally {
        setIsLocalStreaming(false)
      abortControllerRef.current = null
    }
    }
  }, [isAuthenticated, currentChatId, selectedModel, createChat, sendMessage, router, liveLocalMessages])

  const handleRetryMessage = useCallback(async (messageId: string, modelId?: string) => {
    if (!currentChatId) return

    try {
      if (isAuthenticated) {
        // For Convex: Use the proper retryMessage action
        const messageIndex = activeMessages.findIndex(msg => msg.id === messageId)
        if (messageIndex === -1) return

        const messageToRetry = activeMessages[messageIndex]
        if (messageToRetry.role !== 'assistant') return

        await retryMessage({
          chatId: currentChatId as Id<"chats">,
          fromMessageId: messageToRetry.id as Id<"messages">,
          modelId: modelId || selectedModel.id,
        })
      } else {
        // For local: Find the message and remove it + subsequent messages, then regenerate
        const messageIndex = activeMessages.findIndex(msg => msg.id === messageId)
        if (messageIndex === -1) return

        const messageToRetry = activeMessages[messageIndex]
        if (messageToRetry.role !== 'assistant') return

        // Remove the assistant message and any subsequent messages
        const messagesToDelete = activeMessages.slice(messageIndex)
        for (const msg of messagesToDelete) {
          await db.messages.delete(msg.id)
        }

        // Get conversation history up to the retry point (excluding the deleted messages)
        const historyMessages = activeMessages.slice(0, messageIndex)
        const coreHistory: CoreMessage[] = historyMessages.map(m => ({ 
          role: m.role as 'user' | 'assistant', 
          content: typeof m.content === 'string' ? m.content : ''
        }))

        // Regenerate the response with the selected model
        const modelToUse = modelId ? models.find(m => m.id === modelId) || selectedModel : selectedModel
        
        setIsLocalStreaming(true)
        abortControllerRef.current = new AbortController()

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: coreHistory,
            data: { modelId: modelToUse.id },
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.body) throw new Error('No response body')

        const assistantId = uuidv4()
        const assistantMessage: DBMessage = {
          id: assistantId,
          conversationId: currentChatId,
          content: '',
          role: 'assistant',
          createdAt: new Date(),
          model: modelToUse.id,
          parts: [],
        }
        await db.messages.add(assistantMessage)

        const dataStream = parseDataStream(response.body)
        let streamingContent = ''
        let streamingThinking = ''
        let finalThinkingDuration: number | undefined

        for await (const chunk of dataStream) {
          if (abortControllerRef.current?.signal.aborted) break
          if (chunk.type === 'text') {
            streamingContent += chunk.value
            await db.messages.update(assistantId, { content: streamingContent })
          } else if (chunk.type === 'reasoning') {
            streamingThinking += chunk.value
            await db.messages.update(assistantId, { 
              content: streamingContent,
              thinking: streamingThinking 
            })
          } else if (chunk.type === 'finish') {
            finalThinkingDuration = chunk.value?.thinkingDuration
            await db.messages.update(assistantId, { 
              content: streamingContent,
              thinking: streamingThinking || undefined,
              thinkingDuration: finalThinkingDuration
            })
          }
        }
        
        if (!streamingContent.trim()) {
          await db.messages.delete(assistantId)
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error("Error in retry:", error)
        toast.error("Failed to retry message.")
      }
    } finally {
      if (!isAuthenticated) {
        setIsLocalStreaming(false)
        abortControllerRef.current = null
      }
    }
  }, [isAuthenticated, currentChatId, activeMessages, selectedModel, retryMessage])

  const handleStopGeneration = useCallback(async () => {
    if (isAuthenticated && isConvexStreaming) {
      // For Convex, we can't directly abort the streaming action due to consistency constraints
      // The streaming will complete naturally and mark the message as complete
      toast.info("Convex streaming cannot be stopped mid-generation.")
    } else if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLocalStreaming(false)
      toast.info("Generation stopped.")
    }
  }, [isAuthenticated, isConvexStreaming])

  const deleteConversation = useCallback(async (id: string) => {
    if (isAuthenticated) {
      await deleteConvexChat({ chatId: id as Id<"chats"> })
      if (currentChatId === id) {
        router.push('/')
      }
      toast.success('Chat deleted.')
    } else {
      await db.conversations.delete(id)
      await db.messages.where('conversationId').equals(id).delete()
      if (currentChatId === id) {
        router.push('/')
      }
      toast.success('Conversation deleted.')
    }
  }, [isAuthenticated, deleteConvexChat, currentChatId, router])

  useEffect(() => {
    const newChatId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null
    setCurrentChatId(newChatId)
  }, [pathname])

  useEffect(() => {
    if (isAuthLoading || isAuthenticated || !currentChatId) {
      return
    }
    const loadMessages = async () => {
      const currentMessages = await db.messages.where('conversationId').equals(currentChatId).sortBy('createdAt')
    }
    loadMessages()
  }, [currentChatId, isAuthenticated, isAuthLoading])

  return {
    messages: activeMessages,
    chats: activeChats,
    isStreaming: isAuthenticated ? isConvexStreaming : isLocalStreaming,
    isAuthenticated,
    handleNewMessage,
    handleRetryMessage,
    handleStopGeneration,
    deleteConversation,
    currentChatId,
    setCurrentChatId,
    selectedModel,
    setSelectedModel,
  }
}
