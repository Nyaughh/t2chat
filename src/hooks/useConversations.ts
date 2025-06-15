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
  chatId?: string,
  initialMessages?: ConvexMessage[] | null
) => {

  const router = useRouter()
  const pathname = usePathname()
  const chatIdFromUrl = Array.isArray(chatId) ? chatId[1] : chatId;
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatIdFromUrl || null)
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
  } = useConvexChat(currentChatId ? (currentChatId as Id<"chats">) : undefined)

  const [cachedConvexChats, setCachedConvexChats] = useState(convexChats)

  const dexieConversations = useLiveQuery(() => db.conversations.orderBy('lastMessageAt').reverse().toArray(), [])
  const liveLocalMessages = useLiveQuery(
    () => {
      if (!currentChatId) return [];
      // Now loads from Dexie for both auth'd and unauth'd users
      return db.messages.where('conversationId').equals(currentChatId).sortBy('createdAt');
    },
    [currentChatId], // No longer depends on isAuthenticated
    []
  )
  const [isLocalStreaming, setIsLocalStreaming] = useState(false)

  // Sync Convex messages to Dexie for local-first access
  useEffect(() => {
    if (isAuthenticated && convexMessages && currentChatId) {
      const syncToDexie = async () => {
        const messagesToUpsert = convexMessages.map(m => ({
          id: m._id,
          conversationId: m.chatId,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
          model: m.modelId,
          thinking: m.thinking,
          thinkingDuration: m.thinkingDuration,
          attachments: m.attachments,
          parts: [], // Assuming parts are not used for Convex messages
        } as DBMessage))

        if (messagesToUpsert.length > 0) {
          await db.messages.bulkPut(messagesToUpsert);
        }
      }
      syncToDexie()
    }
  }, [isAuthenticated, convexMessages, currentChatId])

  useEffect(() => {
    if (!isConvexStreaming) {
      setCachedConvexChats(convexChats)
    }
  }, [convexChats, isConvexStreaming])

  const activeMessages = useMemo(() => {
    if (isAuthLoading) {
      // Still show initial messages if available on first load
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
      // For authed users, we use Dexie messages as the base
      // and merge with Convex messages as they arrive.
      const localClientMessages = (liveLocalMessages || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        modelId: msg.model,
        thinking: msg.thinking,
        thinkingDuration: msg.thinkingDuration,
        attachments: msg.attachments,
        createdAt: new Date(msg.createdAt),
      } as ClientMessage & { modelId: string; attachments?: any[] }))

      // If convex messages haven't loaded yet, just show local
      if (!convexMessages) {
        return localClientMessages;
      }
      
      // Once convex messages are loaded, they are the source of truth
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
    
    // For anonymous users, just use Dexie
    return (liveLocalMessages || []).map(msg => ({
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
    // If authenticated, ONLY show chats from Convex.
    if (isAuthenticated) {
      const sourceChats = isConvexStreaming ? cachedConvexChats : convexChats
      return (sourceChats || []).map(chat => ({
        id: chat._id,
        title: chat.title || "New Chat",
        createdAt: new Date(chat.createdAt),
        lastMessageAt: new Date(chat.updatedAt),
        isBranch: chat.isBranch,
      })).sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    }
    // For anonymous users, just use Dexie
    return dexieConversations || []
  }, [isAuthenticated, isConvexStreaming, cachedConvexChats, convexChats, dexieConversations])

  const unmigratedLocalChats = useMemo(() => {
    if (!isAuthenticated || !dexieConversations || !convexChats) return [];
    
    const convexChatIds = new Set(convexChats.map(c => c._id));
    return dexieConversations.filter(c => !convexChatIds.has(c.id as Id<"chats">));
  }, [isAuthenticated, dexieConversations, convexChats]);

  // Sync Convex chats to Dexie for local-first access
  useEffect(() => {
    if (isAuthenticated && convexChats) {
      const syncToDexie = async () => {
        const conversationsToUpsert = convexChats.map(c => ({
          id: c._id,
          title: c.title || 'New Chat',
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          lastMessageAt: new Date(c.updatedAt),
        } as DBConversation))
        
        if (conversationsToUpsert.length > 0) {
          await db.conversations.bulkPut(conversationsToUpsert)
        }
      }
      syncToDexie()
    }
  }, [isAuthenticated, convexChats])

  // This effect will redirect the user if the chat is not found
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && currentChatId && convexChats) {
      const chatExists = convexChats.some(chat => chat._id === currentChatId);
      if (!chatExists) {
        router.push('/');
        toast.error("Chat not found.");
      }
    }
  }, [isAuthLoading, isAuthenticated, currentChatId, convexChats, router]);

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
    unmigratedLocalChats,
  }
}
