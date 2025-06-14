'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { db, type Conversation as DBConversation, type DBMessage } from '../lib/dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { useConvexChat } from './use-convex-chat'
import { models, type ModelInfo } from '@/lib/models'
import type { ClientMessage, Attachment, ConvexChat, ConvexMessage } from '@/lib/types'
import type { Id } from '../../convex/_generated/dataModel'
import { parseDataStream } from '@/lib/stream-parser'
import { CoreMessage } from 'ai'

export const useConversations = (
  initialChats?: ConvexChat[] | null,
  chatId?: string,
  initialMessages?: ConvexMessage[] | null
) => {

  const router = useRouter()
  const pathname = usePathname()
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatId || null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(models[0])
  const [mounted, setMounted] = useState(false)

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
    cancelMessage,
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
    if (isAuthLoading) {
      // Return initialMessages during auth loading if available
      if (initialMessages && currentChatId) {
        return initialMessages.map(msg => ({
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
      return [];
    }
    if (isAuthenticated) {
      // Use real-time convex messages once loaded, fallback to initial messages
      const messagesToUse = convexMessages || initialMessages || []
      return messagesToUse.map(msg => ({
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
  }, [isAuthLoading, isAuthenticated, convexMessages, liveLocalMessages, initialMessages, currentChatId])

  const activeChats = useMemo(() => {
    if (isAuthLoading) {
      // Return initialChats during auth loading if available
      if (initialChats) {
        return initialChats.map(chat => ({
          id: chat._id,
          title: chat.title || "New Chat",
          createdAt: new Date(chat.createdAt),
          lastMessageAt: new Date(chat.updatedAt),
        }))
      }
      return []
    }
    if (isAuthenticated) {
      // Use real-time convex chats once loaded, fallback to initial chats
      const chatsToUse = convexChats || initialChats || []
      return chatsToUse.map(chat => ({
        id: chat._id,
        title: chat.title || "New Chat",
        createdAt: new Date(chat.createdAt),
        lastMessageAt: new Date(chat.updatedAt),
      }))
    }
    return dexieConversations || []
  }, [isAuthLoading, isAuthenticated, convexChats, dexieConversations, initialChats])

  const currentConversation = useMemo(
    () => dexieConversations?.find((conv) => conv.id === currentChatId),
    [dexieConversations, currentChatId],
  )

  const abortControllerRef = useRef<AbortController | null>(null)

  // This effect correctly sets the displayed model on mount and on auth change
  // without incorrectly writing to localStorage.
  useEffect(() => {
    setMounted(true);

    const lastUsedModelId = localStorage.getItem('lastUsedModelId');
    const availableModels = isAuthenticated ? models : models.filter((m) => m.isFree);
    
    // Default to the first available model.
    let modelToDisplay = availableModels.length > 0 ? availableModels[0] : models[0];

    if (lastUsedModelId) {
      const preferredModel = models.find(m => m.id === lastUsedModelId);
      // Check if the user's preferred model is valid in the current auth context.
      if (preferredModel && availableModels.some(m => m.id === preferredModel.id)) {
        modelToDisplay = preferredModel;
      }
    }
    setSelectedModel(modelToDisplay);
  }, [isAuthenticated]);

  // This new function handles manual model selection, saving the user's preference.
  const handleSetSelectedModel = (model: ModelInfo) => {
    localStorage.setItem('lastUsedModelId', model.id);
    setSelectedModel(model);
  };

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
        // Use setTimeout to ensure localStorage write completes before navigation
        setTimeout(() => {
          router.push(`/chat/${newChatId}`)
        }, 0)
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
        // Use setTimeout to ensure localStorage write completes before navigation
        setTimeout(() => {
          router.push(`/chat/${conversationId}`)
        }, 0)
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
          if (abortControllerRef.current?.signal.aborted) {
            // Check if message already has stop text (from immediate UI update)
            const currentMessage = await db.messages.get(assistantId)
            if (currentMessage && !currentMessage.content.includes("*Generation was stopped by user.*")) {
              await db.messages.update(assistantId, { 
                content: streamingContent + "\n\n*Generation was stopped by user.*"
              })
            }
            break
          }
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
        
        // Only delete if no content and not aborted
        if (!streamingContent.trim() && !abortControllerRef.current?.signal.aborted) {
          await db.messages.delete(assistantId)
        }

    } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // Generation was stopped by user - no need to show error
          console.log("Generation was stopped by user")
        } else {
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
          if (abortControllerRef.current?.signal.aborted) {
            // Check if message already has stop text (from immediate UI update)
            const currentMessage = await db.messages.get(assistantId)
            if (currentMessage && !currentMessage.content.includes("*Generation was stopped by user.*")) {
              await db.messages.update(assistantId, { 
                content: streamingContent + "\n\n*Generation was stopped by user.*"
              })
            }
            break
          }
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
        
        // Only delete if no content and not aborted
        if (!streamingContent.trim() && !abortControllerRef.current?.signal.aborted) {
          await db.messages.delete(assistantId)
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Generation was stopped by user - no need to show error
        console.log("Retry generation was stopped by user")
      } else {
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
      // For Convex, immediately show stopped in UI, then cancel on server
      const lastMessage = convexMessages?.[convexMessages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isComplete) {
        // Immediately show the stop message in UI
        toast.success("Generation stopped.")
        
        // Cancel on server in background
        try {
          await cancelMessage({ messageId: lastMessage._id as Id<"messages"> })
        } catch (error) {
          console.error("Failed to cancel on server:", error)
          // Don't show error to user since they already see "stopped" message
        }
      } else {
        toast.info("No active generation to stop.")
      }
    } else if (isLocalStreaming && abortControllerRef.current) {
      // For local streaming, immediately stop UI and update message
      setIsLocalStreaming(false)
      toast.success("Generation stopped.")
      
      // Find and immediately update the last streaming message
      try {
        const localMessages = await db.messages
          .where('conversationId')
          .equals(currentChatId || '')
          .sortBy('createdAt')
        
        const lastMessage = localMessages[localMessages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          await db.messages.update(lastMessage.id, {
            content: lastMessage.content + "\n\n*Generation was stopped by user.*"
          })
        }
      } catch (error) {
        console.error("Failed to update stopped message:", error)
      }
      
      // Abort the request in background
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    } else {
      toast.info("No active generation to stop.")
    }
  }, [isAuthenticated, isConvexStreaming, isLocalStreaming, convexMessages, cancelMessage, currentChatId])

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
    setSelectedModel: handleSetSelectedModel,
    mounted,
  }
}
