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
import type { ModelMessage } from 'ai'
import { streamGuestReply, toModelHistory, type GuestStreamSnapshot } from '@/lib/guest-stream'
import { dexieGuestMessageStore } from '@/lib/local-data'
import { useLocalDataVisible } from './useLocalDataGuard'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

type ActiveMessage = ClientMessage & { modelId: string; attachments?: any[]; toolCalls?: any[] }

const convexToClientMessage = (msg: ConvexMessage & { toolCalls?: any[] }): ActiveMessage =>
  ({
    id: msg._id,
    role: msg.role,
    content: msg.content,
    modelId: msg.modelId,
    thinking: msg.thinking,
    thinkingDuration: msg.thinkingDuration,
    attachments: msg.attachments,
    toolCalls: msg.toolCalls,
    createdAt: new Date(msg.createdAt),
  }) as ActiveMessage

const localToClientMessage = (msg: DBMessage): ActiveMessage =>
  ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    modelId: msg.model,
    thinking: msg.thinking,
    thinkingDuration: msg.thinkingDuration,
    attachments: msg.attachments,
    createdAt: new Date(msg.createdAt),
  }) as ActiveMessage

const toChatList = (chats: ConvexChat[]) =>
  chats
    .map((chat) => ({
      id: chat._id,
      title: chat.title || 'New Chat',
      createdAt: new Date(chat.createdAt),
      lastMessageAt: new Date(chat.updatedAt),
      isBranch: chat.isBranch,
    }))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())

export const useConversations = (
  chatId?: string,
  initialMessages?: ConvexMessage[] | null,
  initialChats?: ConvexChat[] | null,
) => {
  const router = useRouter()
  const pathname = usePathname()
  const chatIdFromUrl = Array.isArray(chatId) ? chatId[1] : chatId
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatIdFromUrl || null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(models[0])
  const [mounted, setMounted] = useState(false)

  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isStreaming: isConvexStreaming,
    chatExists: convexChatExists,
    messages: convexMessages,
    chats: convexChats,
    createChat,
    sendMessage,
    retryMessage,
    editMessageAndRegenerate,
    deleteChat: deleteConvexChat,
    deleteMessagesFromIndex,
    cancelMessage,
    editMessage,
  } = useConvexChat(currentChatId ? (currentChatId as Id<'chats'>) : undefined)

  const userSettings = useQuery(api.users.getMySettings, isAuthenticated ? {} : 'skip')
  const disabledModels = useQuery(api.api_keys.getDisabledModels, isAuthenticated ? {} : 'skip') || []

  const [cachedConvexChats, setCachedConvexChats] = useState(convexChats)

  // IndexedDB only holds guest chats. Signed-in chats come from Convex and are
  // never copied here (audit P2/S7). `localDataVisible` stays false until the
  // previous session's local chats have been wiped, if they need to be.
  const { visible: localDataVisible, signedIn: sessionSignedIn } = useLocalDataVisible()
  const liveDexieConversations = useLiveQuery(
    () => db.conversations.orderBy('lastMessageAt').reverse().toArray(),
    [],
  )
  const dexieConversations = localDataVisible ? liveDexieConversations : undefined
  const liveDexieMessages = useLiveQuery(
    () => {
      if (!currentChatId || isAuthenticated) return []
      return db.messages.where('conversationId').equals(currentChatId).sortBy('createdAt')
    },
    [currentChatId, isAuthenticated],
    [],
  )
  const liveLocalMessages = useMemo(
    // Guest messages are never shown while the auth session still says someone
    // is signed in, even if Convex already treats the user as signed out.
    () => (localDataVisible && !isAuthenticated && !sessionSignedIn ? liveDexieMessages || [] : []),
    [localDataVisible, isAuthenticated, sessionSignedIn, liveDexieMessages],
  )
  const [isLocalStreaming, setIsLocalStreaming] = useState(false)
  // Latest text of the guest reply being streamed. IndexedDB is only written
  // every few hundred ms, so the UI reads the live text from here.
  const [localStream, setLocalStream] = useState<GuestStreamSnapshot | null>(null)

  useEffect(() => {
    if (!isConvexStreaming) {
      setCachedConvexChats(convexChats)
    }
  }, [convexChats, isConvexStreaming])

  const activeMessages = useMemo((): ActiveMessage[] => {
    // Server-provided messages, only if they belong to the open chat.
    const initialForCurrentChat = () =>
      initialMessages && currentChatId && initialMessages.every((m) => m.chatId === currentChatId)
        ? initialMessages.map(convexToClientMessage)
        : []

    if (isAuthLoading) return initialForCurrentChat()

    if (isAuthenticated) {
      // Convex is the source of truth for signed-in users.
      return convexMessages ? convexMessages.map(convexToClientMessage) : initialForCurrentChat()
    }

    // Guests: IndexedDB, with the live text of a streaming reply on top.
    return liveLocalMessages.map((msg) => {
      const client = localToClientMessage(msg)
      if (localStream && localStream.id === msg.id) {
        client.content = localStream.content
        client.thinking = localStream.thinking
        client.thinkingDuration = localStream.thinkingDuration
      }
      return client
    })
  }, [isAuthLoading, isAuthenticated, convexMessages, liveLocalMessages, localStream, initialMessages, currentChatId])

  const activeChats = useMemo(() => {
    // If authenticated, ONLY show chats from Convex.
    if (isAuthenticated) {
      const sourceChats = isConvexStreaming ? cachedConvexChats : convexChats
      // Use initialChats as fallback if convex chats haven't loaded yet
      const chatsToUse = sourceChats || initialChats || []
      return toChatList(chatsToUse)
    }
    // While auth is loading, show the server-rendered list. Once we know the
    // user is signed out, never show it: it can still hold the previous user's
    // chats until the page refreshes after sign-out.
    if (isAuthLoading) {
      return toChatList(initialChats || [])
    }
    // Signed out: guest chats from IndexedDB only.
    if (sessionSignedIn) return []
    return (
      dexieConversations?.map((chat) => ({
        id: chat.id as Id<'chats'>,
        title: chat.title || 'New Chat',
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        lastMessageAt: new Date(chat.updatedAt),
        isBranch: false,
      })) || []
    )
  }, [
    isAuthenticated,
    isAuthLoading,
    sessionSignedIn,
    isConvexStreaming,
    cachedConvexChats,
    convexChats,
    dexieConversations,
    initialChats,
  ])

  const unmigratedLocalChatsRef = useRef<DBConversation[]>([])
  const unmigratedLocalChats = useMemo(() => {
    if (!isAuthenticated || !dexieConversations || !convexChats) {
      return []
    }

    const convexChatIds = new Set(convexChats.map((c) => c._id))
    const newUnmigrated = dexieConversations.filter((c) => !convexChatIds.has(c.id as Id<'chats'>))

    const oldUnmigrated = unmigratedLocalChatsRef.current

    if (
      newUnmigrated.length === oldUnmigrated.length &&
      newUnmigrated.every((chat, i) => chat.id === oldUnmigrated[i].id)
    ) {
      return oldUnmigrated
    }

    unmigratedLocalChatsRef.current = newUnmigrated
    return newUnmigrated
  }, [isAuthenticated, dexieConversations, convexChats])

  // This effect will redirect the user if the chat is not found
  useEffect(() => {
    if (!isAuthLoading && currentChatId) {
      if (isAuthenticated) {
        // For authenticated users, check using the chatExists flag from useConvexChat
        // This prevents the Convex query error by checking chat existence first
        if (convexChats && !convexChatExists) {
          router.push('/')
          toast.error('Chat not found.')
        }
      } else {
        // For unauthenticated users, check against local Dexie conversations
        if (dexieConversations && !sessionSignedIn) {
          const conversationExists = dexieConversations.some((conv) => conv.id === currentChatId)
          if (!conversationExists) {
            router.push('/')
            toast.error('Chat not found.')
          }
        }
      }
    }
  }, [
    isAuthLoading,
    isAuthenticated,
    sessionSignedIn,
    currentChatId,
    convexChats,
    convexChatExists,
    dexieConversations,
    router,
  ])

  const abortControllerRef = useRef<AbortController | null>(null)

  // This effect correctly sets the displayed model on mount and on auth change
  // without incorrectly writing to localStorage.
  useEffect(() => {
    setMounted(true)

    const lastUsedModelId = localStorage.getItem('lastUsedModelId')
    const availableModels = models.filter((m) => {
      // Check if model is disabled by user
      if (isAuthenticated && disabledModels.includes(m.id)) {
        return false
      }
      // For unauthenticated users, only show free models
      if (!isAuthenticated && !m.isFree) {
        return false
      }
      return true
    })

    // Default to the first available model.
    let modelToDisplay = availableModels.length > 0 ? availableModels[0] : models[0]

    if (lastUsedModelId) {
      const preferredModel = models.find((m) => m.id === lastUsedModelId)
      // Check if the user's preferred model is valid in the current auth context.
      if (preferredModel && availableModels.some((m) => m.id === preferredModel.id)) {
        modelToDisplay = preferredModel
      }
    }
    setSelectedModel(modelToDisplay)
  }, [isAuthenticated, disabledModels])

  // This new function handles manual model selection, saving the user's preference.
  const handleSetSelectedModel = (model: ModelInfo) => {
    localStorage.setItem('lastUsedModelId', model.id)
    setSelectedModel(model)
  }

  // Streams one guest reply into `conversationId`. A stop is not an error: the
  // helper saves the partial reply with the "stopped" note. Other errors are
  // thrown to the caller, which reports them.
  const runGuestReply = useCallback(async (conversationId: string, history: ModelMessage[], modelId: string) => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLocalStream(null)
    setIsLocalStreaming(true)
    try {
      const result = await streamGuestReply({
        conversationId,
        history,
        modelId,
        signal: controller.signal,
        store: dexieGuestMessageStore,
        onUpdate: setLocalStream,
      })
      if (result.error) toast.error(result.error)
      return result
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
      if (abortControllerRef.current === null) setIsLocalStreaming(false)
    }
  }, [])

  const handleNewMessage = useCallback(
    async (
      input: string,
      options?: {
        attachments?: Attachment[]
        modelId?: string
        webSearch?: boolean
      },
    ) => {
      if (isAuthenticated) {
        let chatId = currentChatId as Id<'chats'>
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
        try {
          const now = new Date()
          let conversationId = currentChatId
          if (!conversationId) {
            const newConversationId = uuidv4()
            conversationId = newConversationId
            await db.conversations.add({
              id: newConversationId,
              title: input.split(' ').slice(0, 4).join(' '),
              createdAt: now,
              updatedAt: now,
              lastMessageAt: now,
            })
            setTimeout(() => {
              router.push(`/chat/${newConversationId}`)
            }, 0)
          } else {
            await db.conversations.update(conversationId, { updatedAt: now, lastMessageAt: now })
          }

          const userMessage: DBMessage = {
            id: uuidv4(),
            conversationId,
            content: input,
            role: 'user',
            createdAt: now,
            model: selectedModel.id,
            parts: [],
          }
          await db.messages.add(userMessage)

          await runGuestReply(conversationId, toModelHistory([...liveLocalMessages, userMessage]), selectedModel.id)
        } catch (error) {
          console.error('Error in local stream:', error)
          toast.error('An error occurred while getting the response.')
        }
      }
    },
    [isAuthenticated, currentChatId, selectedModel, createChat, sendMessage, router, liveLocalMessages, runGuestReply],
  )

  const handleRetryMessage = useCallback(
    async (messageId: string, modelId?: string) => {
      if (!currentChatId) return

      try {
        const messageIndex = activeMessages.findIndex((msg) => msg.id === messageId)
        if (messageIndex === -1) return

        const messageToRetry = activeMessages[messageIndex]
        if (messageToRetry.role !== 'assistant') return

        if (isAuthenticated) {
          await retryMessage({
            chatId: currentChatId as Id<'chats'>,
            fromMessageId: messageToRetry.id as Id<'messages'>,
            modelId: modelId || selectedModel.id,
          })
        } else {
          // Remove the assistant message and everything after it, then regenerate
          // from the history before it.
          await db.messages.bulkDelete(activeMessages.slice(messageIndex).map((msg) => msg.id))
          const modelToUse = modelId ? models.find((m) => m.id === modelId) || selectedModel : selectedModel
          await runGuestReply(currentChatId, toModelHistory(activeMessages.slice(0, messageIndex)), modelToUse.id)
        }
      } catch (error) {
        console.error('Error in retry:', error)
        toast.error('Failed to retry message.')
      }
    },
    [isAuthenticated, currentChatId, activeMessages, selectedModel, retryMessage, runGuestReply],
  )

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!currentChatId) return

      try {
        if (isAuthenticated) {
          // For Convex: Use the editMessageAndRegenerate action to edit and regenerate response
          await editMessageAndRegenerate({
            messageId: messageId as Id<'messages'>,
            content: content.trim(),
            modelId: selectedModel.id,
          })
        } else {
          await db.messages.update(messageId, { content: content.trim() })

          const allMessages = await db.messages.where('conversationId').equals(currentChatId).sortBy('createdAt')
          const editedMessageIndex = allMessages.findIndex((msg) => msg.id === messageId)
          if (editedMessageIndex !== -1) {
            // Find the next assistant message after the edited user message
            let nextAssistantMessageIndex = -1
            for (let i = editedMessageIndex + 1; i < allMessages.length; i++) {
              if (allMessages[i].role === 'assistant') {
                nextAssistantMessageIndex = i
                break
              }
            }

            // Delete that reply and everything after it, then regenerate.
            if (nextAssistantMessageIndex !== -1) {
              await db.messages.bulkDelete(allMessages.slice(nextAssistantMessageIndex).map((msg) => msg.id))
              await runGuestReply(
                currentChatId,
                toModelHistory(allMessages.slice(0, nextAssistantMessageIndex)),
                selectedModel.id,
              )
            }
          }
        }
        toast.success('Message edited and response regenerated.')
      } catch (error) {
        console.error('Error editing message:', error)
        toast.error('Failed to edit message.')
      }
    },
    [isAuthenticated, editMessageAndRegenerate, selectedModel, currentChatId, runGuestReply],
  )

  const handleStopGeneration = useCallback(async () => {
    if (isAuthenticated && isConvexStreaming) {
      // For Convex, immediately show stopped in UI, then cancel on server
      const lastMessage = convexMessages?.[convexMessages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isComplete) {
        // Immediately show the stop message in UI
        toast.success('Generation stopped.')

        // Cancel on server in background
        try {
          await cancelMessage({ messageId: lastMessage._id as Id<'messages'> })
        } catch (error) {
          console.error('Failed to cancel on server:', error)
          // Don't show error to user since they already see "stopped" message
        }
      } else {
        toast.info('No active generation to stop.')
      }
    } else if (isLocalStreaming && abortControllerRef.current) {
      // The guest stream loop appends the "stopped" note and saves the partial
      // reply as soon as the request is aborted.
      abortControllerRef.current.abort()
      setIsLocalStreaming(false)
      toast.success('Generation stopped.')
    } else {
      toast.info('No active generation to stop.')
    }
  }, [isAuthenticated, isConvexStreaming, isLocalStreaming, convexMessages, cancelMessage])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        if (isAuthenticated) {
          await deleteConvexChat({ chatId: id as Id<'chats'> })
          toast.success('Chat deleted.')
        } else {
          await db.conversations.delete(id)
          await db.messages.where('conversationId').equals(id).delete()
          toast.success('Conversation deleted.')
        }

        // Always redirect to home if we're currently viewing the deleted chat
        if (currentChatId === id) {
          router.push('/')
        }
      } catch (error) {
        console.error('Error deleting conversation:', error)
        toast.error('Failed to delete conversation.')
      }
    },
    [isAuthenticated, deleteConvexChat, currentChatId, router],
  )

  useEffect(() => {
    const newChatId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null
    setCurrentChatId(newChatId)
  }, [pathname])

  return {
    messages: activeMessages,
    chats: activeChats,
    isStreaming: isAuthenticated ? isConvexStreaming : isLocalStreaming,
    isAuthenticated,
    handleNewMessage,
    handleRetryMessage,
    handleEditMessage,
    handleStopGeneration,
    deleteConversation,
    currentChatId,
    setCurrentChatId,
    selectedModel,
    setSelectedModel: handleSetSelectedModel,
    mounted,
    unmigratedLocalChats,
    userSettings,
  }
}
