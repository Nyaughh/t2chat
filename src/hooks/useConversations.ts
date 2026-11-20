'use client'

import { useState, useMemo, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
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
import {
  toModelHistory,
  type GuestReplyResult,
  type GuestReplyView,
  type GuestStreamSnapshot,
} from '@/lib/guest-stream'
import {
  GuestChatUnavailableError,
  addGuestMessage,
  createGuestConversation,
  deleteGuestConversation,
  deleteGuestMessages,
  guestReplies,
  readGuestHistory,
  updateGuestMessageContent,
} from '@/lib/local-data'
import {
  chatsBelongTo,
  createSendGate,
  importableLocalChats,
  isGuestLocalId,
  isLocalRowVisible,
  nextLeaseExpiry,
  type SendDestination,
} from '@/lib/local-data-policy'
import { useLocalOwnership } from './useLocalOwnership'
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

const NO_GUEST_REPLIES: ReadonlyMap<string, GuestReplyView> = new Map()

const reportGuestError = (error: unknown, fallback: string) => {
  if (error instanceof GuestChatUnavailableError) {
    toast.error(error.message)
  } else {
    console.error(fallback, error)
    toast.error(fallback)
  }
}

const reportGuestResult = (result: GuestReplyResult) => {
  if (result.error) toast.error(result.error)
  else if (result.status === 'claimed') toast.info('You signed in, so this reply stopped. What arrived is kept for import.')
  else if (result.status === 'rejected') toast.error('This chat is no longer available.')
}

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
    messages: convexMessages,
    chats: convexChats,
    createChat,
    sendMessage,
    retryMessage,
    editMessageAndRegenerate,
    deleteChat: deleteConvexChat,
    cancelMessage,
  } = useConvexChat(currentChatId ? (currentChatId as Id<'chats'>) : undefined)

  const userSettings = useQuery(api.users.getMySettings, isAuthenticated ? {} : 'skip')
  const disabledModels = useQuery(api.api_keys.getDisabledModels, isAuthenticated ? {} : 'skip') || []

  // The Better Auth session is the verified identity. Its user id is the app
  // `users` id, the same id the server stores in `chats.userId`.
  const { session, signingOut } = useLocalOwnership()
  const verifiedUserId = session.status === 'signed-in' ? session.userId : null

  // The identity Convex itself is using. It can lag behind the session (an old
  // token is still in use after a sign-out or account switch), so Convex data
  // and Convex writes count only when it is the verified user. getCurrentUser
  // looks the user up by the token's subject, so its `userId` is that subject.
  const convexIdentity = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : 'skip') as
    | { userId?: string }
    | null
    | undefined
  const convexBoundUserId =
    isAuthenticated && verifiedUserId && convexIdentity?.userId === verifiedUserId ? verifiedUserId : null

  // --- Signed-in data: only results that belong to the verified identity ----

  const verifiedConvexChats = useMemo(
    () =>
      convexChats && convexBoundUserId && chatsBelongTo(convexChats, convexBoundUserId) ? convexChats : undefined,
    [convexChats, convexBoundUserId],
  )
  const verifiedChatExists = useMemo(
    () => !!currentChatId && !!verifiedConvexChats?.some((chat) => chat._id === currentChatId),
    [currentChatId, verifiedConvexChats],
  )
  const verifiedConvexMessages = useMemo(
    () =>
      verifiedChatExists && convexMessages && convexMessages.every((m) => m.chatId === currentChatId)
        ? convexMessages
        : undefined,
    [verifiedChatExists, convexMessages, currentChatId],
  )
  const isConvexStreaming = useMemo(() => {
    const last = verifiedConvexMessages?.[verifiedConvexMessages.length - 1]
    return !!last && last.role === 'assistant' && !last.isComplete
  }, [verifiedConvexMessages])

  // Chat list frozen while a reply streams (avoids title flicker), per user.
  const [cachedChats, setCachedChats] = useState<{ userId: string; chats: ConvexChat[] } | null>(null)
  useEffect(() => {
    if (!isConvexStreaming && verifiedConvexChats && verifiedUserId) {
      setCachedChats({ userId: verifiedUserId, chats: verifiedConvexChats })
    }
  }, [verifiedConvexChats, isConvexStreaming, verifiedUserId])
  const cachedChatsForUser = cachedChats && cachedChats.userId === verifiedUserId ? cachedChats.chats : undefined

  // Server-rendered chat list. Usable only for the account it was rendered for:
  // while the first session check is pending, or once the session confirms the
  // same user. Discarded for good once a different or no account is seen.
  const initialOwner = initialChats && initialChats.length > 0 ? initialChats[0].userId : null
  const initialMismatch =
    initialOwner !== null &&
    (session.status === 'signed-out' ||
      session.status === 'unknown' ||
      (session.status === 'signed-in' && session.userId !== initialOwner))
  const [revokedInitialChats, setRevokedInitialChats] = useState<ConvexChat[] | null>(null)
  useEffect(() => {
    if (initialMismatch && initialChats) setRevokedInitialChats(initialChats)
  }, [initialMismatch, initialChats])
  const usableInitialChats = useMemo((): ConvexChat[] | null => {
    if (!initialChats || initialOwner === null) return null
    if (initialMismatch || revokedInitialChats === initialChats) return null
    if (!chatsBelongTo(initialChats, initialOwner)) return null
    return initialChats
  }, [initialChats, initialOwner, initialMismatch, revokedInitialChats])

  // --- Local (guest) data: only rows the current viewer may see --------------

  // The guest view is used only when no one is signed in according to both
  // Convex and the auth session.
  const isGuestView = !isAuthenticated && !verifiedUserId
  const liveLocalConversations = useLiveQuery(() => db.conversations.orderBy('lastMessageAt').reverse().toArray(), [])
  const guestConversations = useMemo(
    () =>
      isGuestView && liveLocalConversations
        ? liveLocalConversations.filter((conv) => isLocalRowVisible(conv, session))
        : undefined,
    [isGuestView, liveLocalConversations, session],
  )
  // The conversation row is read with its messages, so ownership is checked on
  // the same snapshot the messages come from.
  const liveGuestThread = useLiveQuery(
    async () => {
      if (!currentChatId || isAuthenticated) return null
      const conv = await db.conversations.get(currentChatId)
      if (!conv) return { conv: null, messages: [] as DBMessage[] }
      const messages = await db.messages.where('conversationId').equals(currentChatId).sortBy('createdAt')
      return { conv, messages }
    },
    [currentChatId, isAuthenticated],
    null,
  )
  const liveLocalMessages = useMemo(() => {
    const conv = liveGuestThread?.conv
    if (!isGuestView || !conv || conv.id !== currentChatId || !isLocalRowVisible(conv, session)) return []
    return liveGuestThread.messages
  }, [isGuestView, liveGuestThread, currentChatId, session])

  // Guest replies are tracked per conversation. A new chat started from the
  // home page is followed by this view until the URL switches to it.
  const guestReplyViews = useSyncExternalStore(guestReplies.subscribe, guestReplies.getSnapshot, () => NO_GUEST_REPLIES)
  const [launchedChatId, setLaunchedChatId] = useState<string | null>(null)
  useEffect(() => {
    if (currentChatId) setLaunchedChatId(null)
  }, [currentChatId])
  const streamChatId = currentChatId ?? launchedChatId
  const guestReply = streamChatId ? guestReplyViews.get(streamChatId) : undefined
  const isLocalStreaming = !!guestReply?.streaming

  // A reply's registry entry is released as soon as it ends. Its last text is
  // held here only until IndexedDB shows the same text (so the older throttled
  // write never flashes), the message is gone or hidden, or the view moves to
  // another chat.
  const [heldOverlay, setHeldOverlay] = useState<GuestStreamSnapshot | null>(null)
  const runningSnapshot = guestReply?.snapshot ?? null
  // Reset first, so a view that mounts mid-reply keeps the snapshot it then captures.
  useEffect(() => {
    setHeldOverlay(null)
  }, [streamChatId])
  useEffect(() => {
    if (runningSnapshot) setHeldOverlay(runningSnapshot)
  }, [runningSnapshot])
  useEffect(() => {
    if (!heldOverlay || isLocalStreaming) return
    const row = liveLocalMessages.find((m) => m.id === heldOverlay.id)
    if (!row || (row.content === heldOverlay.content && (row.thinking || undefined) === heldOverlay.thinking)) {
      setHeldOverlay(null)
    }
  }, [heldOverlay, isLocalStreaming, liveLocalMessages])
  const streamChatIdRef = useRef(streamChatId)
  streamChatIdRef.current = streamChatId

  // Save buffered guest reply text when this view goes away or the page is hidden.
  // The reply itself keeps running, so the first guest send survives the
  // navigation from the home page to the new chat.
  useEffect(() => {
    const flushAll = () => void guestReplies.flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    window.addEventListener('pagehide', flushAll)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      document.removeEventListener('visibilitychange', onVisibility)
      // This view's chat; the reply keeps running for the next page.
      const id = streamChatIdRef.current
      if (id) void guestReplies.flush(id)
    }
  }, [])

  // --- What the UI shows -----------------------------------------------------

  const activeMessages = useMemo((): ActiveMessage[] => {
    // Server-provided messages, only for the open chat and a matching identity.
    const initialForCurrentChat = () =>
      initialMessages &&
      currentChatId &&
      (session.status === 'pending' || verifiedChatExists) &&
      initialMessages.every((m) => m.chatId === currentChatId)
        ? initialMessages.map(convexToClientMessage)
        : []

    if (isAuthLoading) return initialForCurrentChat()

    if (isAuthenticated) {
      // Convex is the source of truth for signed-in users.
      return verifiedConvexMessages ? verifiedConvexMessages.map(convexToClientMessage) : initialForCurrentChat()
    }

    // Guests: IndexedDB, with the live text of a streaming reply on top.
    const live = runningSnapshot ?? heldOverlay
    return liveLocalMessages.map((msg) => {
      const client = localToClientMessage(msg)
      if (live && live.id === msg.id) {
        client.content = live.content
        client.thinking = live.thinking
        client.thinkingDuration = live.thinkingDuration
      }
      return client
    })
  }, [
    isAuthLoading,
    isAuthenticated,
    verifiedConvexMessages,
    verifiedChatExists,
    liveLocalMessages,
    runningSnapshot,
    heldOverlay,
    initialMessages,
    currentChatId,
    session,
  ])

  const activeChats = useMemo(() => {
    if (isAuthenticated) {
      const sourceChats = isConvexStreaming ? (cachedChatsForUser ?? verifiedConvexChats) : verifiedConvexChats
      // Fall back to the server-rendered list while Convex loads, if it is this user's.
      return toChatList(sourceChats || usableInitialChats || [])
    }
    if (isAuthLoading) return toChatList(usableInitialChats || [])
    // Signed out: unowned guest chats from IndexedDB only.
    return (
      guestConversations?.map((chat) => ({
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
    isConvexStreaming,
    cachedChatsForUser,
    verifiedConvexChats,
    usableInitialChats,
    guestConversations,
  ])

  // A chat with a guest reply still being written (in any tab) becomes
  // importable when its lease is released, which changes the row, or when the
  // lease expires because its tab died. Re-check at that expiry.
  const [leaseCheck, setLeaseCheck] = useState(0)
  useEffect(() => {
    if (!liveLocalConversations) return
    const next = nextLeaseExpiry(liveLocalConversations, Date.now())
    if (next === null) return
    const timer = setTimeout(() => setLeaseCheck((n) => n + 1), Math.max(0, next - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [liveLocalConversations, leaseCheck])

  // Local chats the signed-in user can import: theirs (claim committed), not
  // on the server yet, and with no guest reply still being written, so the
  // import never copies a reply before its final text is stored. Hidden while
  // a sign-out request is in flight.
  const unmigratedLocalChatsRef = useRef<DBConversation[]>([])
  const unmigratedLocalChats = useMemo(() => {
    if (!isAuthenticated || !verifiedUserId || signingOut || !liveLocalConversations || !verifiedConvexChats) {
      return []
    }

    const convexChatIds = new Set<string>(verifiedConvexChats.map((c) => c._id))
    const newUnmigrated = importableLocalChats(liveLocalConversations, session, convexChatIds, Date.now())

    const oldUnmigrated = unmigratedLocalChatsRef.current

    if (
      newUnmigrated.length === oldUnmigrated.length &&
      newUnmigrated.every((chat, i) => chat.id === oldUnmigrated[i].id)
    ) {
      return oldUnmigrated
    }

    unmigratedLocalChatsRef.current = newUnmigrated
    return newUnmigrated
    // leaseCheck: re-evaluate when a reply lease expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, verifiedUserId, signingOut, liveLocalConversations, verifiedConvexChats, session, leaseCheck])

  // This effect will redirect the user if the chat is not found
  useEffect(() => {
    if (!isAuthLoading && currentChatId) {
      if (isAuthenticated) {
        if (verifiedConvexChats && !verifiedChatExists) {
          router.push('/')
          toast.error('Chat not found.')
        }
      } else if (guestConversations) {
        if (!guestConversations.some((conv) => conv.id === currentChatId)) {
          router.push('/')
          toast.error('Chat not found.')
        }
      }
    }
  }, [isAuthLoading, isAuthenticated, currentChatId, verifiedConvexChats, verifiedChatExists, guestConversations, router])

  // --- Where writes go -------------------------------------------------------

  // Guest writes need a confirmed signed-out session. A pending session, a
  // signed-in user still waiting for a Convex token, or an unknown session
  // while this browser holds a signed-in user's chats, waits. (An unknown
  // session with only unowned guest chats may write: nothing of another user
  // is at stake, and a guest isn't locked out when the auth check is down.)
  const hasOwnedLocalChats = !!liveLocalConversations?.some((conv) => conv.userId)
  const guestAllowed =
    session.status === 'signed-out' ||
    (session.status === 'unknown' && liveLocalConversations !== undefined && !hasOwnedLocalChats)
  const destinationKey = convexBoundUserId
    ? `convex:${convexBoundUserId}`
    : !isAuthenticated && !isAuthLoading && guestAllowed
      ? 'guest'
      : null
  const destination = useMemo(
    (): SendDestination | null =>
      destinationKey === 'guest'
        ? { kind: 'guest' }
        : destinationKey && convexBoundUserId
          ? { kind: 'convex', userId: convexBoundUserId }
          : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinationKey],
  )

  // Sends made before it is known where they may go wait here, bound to the
  // identity on screen when they were made (see decideQueuedSend). They are
  // cancelled, with a message, if that identity changes or this view closes.
  const [sendGate] = useState(() => createSendGate({ session, destination }))
  useEffect(() => {
    sendGate.update({ session, destination })
  }, [sendGate, session, destination])
  useEffect(() => {
    sendGate.open()
    return () => sendGate.close()
  }, [sendGate])

  /** Where a write made now may go, or null if it was cancelled (the user is told). */
  const resolveDestination = useCallback(async (): Promise<SendDestination | null> => {
    const { queued, decision } = sendGate.request()
    const waitingToast = queued ? toast.loading('Waiting for sign-in to finish before sending…') : undefined
    const result = await decision
    if (waitingToast !== undefined) toast.dismiss(waitingToast)
    if (result.kind === 'cancelled') {
      toast.error(
        result.reason === 'closed'
          ? 'Not sent: the page changed before sign-in finished.'
          : 'Not sent: you signed out or switched accounts.',
      )
      return null
    }
    return result
  }, [sendGate])

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

  const runGuestReply = useCallback(async (conversationId: string, history: ModelMessage[], modelId: string) => {
    reportGuestResult(await guestReplies.run({ conversationId, history, modelId }))
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
      // The chat the user typed into, captured before waiting.
      const targetChatId = currentChatId
      const target = await resolveDestination()
      if (!target) return

      if (target.kind === 'convex') {
        // A local chat id can't be sent to Convex: start a new server chat.
        let chatId = targetChatId && !isGuestLocalId(targetChatId) ? (targetChatId as Id<'chats'>) : null
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
        return
      }

      try {
        const now = new Date()
        let conversationId = targetChatId
        // Null when the chat doesn't exist or isn't an unowned guest chat.
        let history = conversationId ? await readGuestHistory(conversationId) : null
        if (!conversationId || history === null) {
          // New chat, or the old one is gone: keep the message in a new guest chat.
          const newConversationId = uuidv4()
          conversationId = newConversationId
          history = []
          await createGuestConversation({
            id: newConversationId,
            title: input.split(' ').slice(0, 4).join(' '),
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
          })
          if (!targetChatId) setLaunchedChatId(newConversationId)
          setTimeout(() => {
            router.push(`/chat/${newConversationId}`)
          }, 0)
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
        await addGuestMessage(userMessage)
        await runGuestReply(conversationId, toModelHistory([...history, userMessage]), selectedModel.id)
      } catch (error) {
        reportGuestError(error, 'An error occurred while getting the response.')
      }
    },
    [currentChatId, selectedModel, createChat, sendMessage, router, resolveDestination, runGuestReply],
  )

  const handleRetryMessage = useCallback(
    async (messageId: string, modelId?: string) => {
      if (!currentChatId) return
      const chatId = currentChatId

      try {
        const messageIndex = activeMessages.findIndex((msg) => msg.id === messageId)
        if (messageIndex === -1) return

        const messageToRetry = activeMessages[messageIndex]
        if (messageToRetry.role !== 'assistant') return

        const target = await resolveDestination()
        if (!target) return
        if (target.kind === 'convex') {
          if (isGuestLocalId(chatId)) throw new GuestChatUnavailableError()
          await retryMessage({
            chatId: chatId as Id<'chats'>,
            fromMessageId: messageToRetry.id as Id<'messages'>,
            modelId: modelId || selectedModel.id,
          })
        } else {
          // Remove the assistant message and everything after it, then regenerate
          // from the history before it.
          await deleteGuestMessages(
            chatId,
            activeMessages.slice(messageIndex).map((msg) => msg.id),
          )
          const modelToUse = modelId ? models.find((m) => m.id === modelId) || selectedModel : selectedModel
          await runGuestReply(chatId, toModelHistory(activeMessages.slice(0, messageIndex)), modelToUse.id)
        }
      } catch (error) {
        reportGuestError(error, 'Failed to retry message.')
      }
    },
    [currentChatId, activeMessages, selectedModel, retryMessage, resolveDestination, runGuestReply],
  )

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!currentChatId) return
      const chatId = currentChatId

      try {
        const target = await resolveDestination()
        if (!target) return
        if (target.kind === 'convex') {
          if (isGuestLocalId(chatId)) throw new GuestChatUnavailableError()
          await editMessageAndRegenerate({
            messageId: messageId as Id<'messages'>,
            content: content.trim(),
            modelId: selectedModel.id,
          })
        } else {
          await updateGuestMessageContent(chatId, messageId, content.trim())

          const allMessages = await readGuestHistory(chatId)
          if (!allMessages) throw new GuestChatUnavailableError()
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
              await deleteGuestMessages(
                chatId,
                allMessages.slice(nextAssistantMessageIndex).map((msg) => msg.id),
              )
              await runGuestReply(
                chatId,
                toModelHistory(allMessages.slice(0, nextAssistantMessageIndex)),
                selectedModel.id,
              )
            }
          }
        }
        toast.success('Message edited and response regenerated.')
      } catch (error) {
        reportGuestError(error, 'Failed to edit message.')
      }
    },
    [editMessageAndRegenerate, selectedModel, currentChatId, resolveDestination, runGuestReply],
  )

  const handleStopGeneration = useCallback(async () => {
    if (isAuthenticated && isConvexStreaming) {
      // For Convex, immediately show stopped in UI, then cancel on server
      const lastMessage = verifiedConvexMessages?.[verifiedConvexMessages.length - 1]
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
    } else if (isLocalStreaming && streamChatId && guestReplies.stop(streamChatId)) {
      // The guest stream loop appends the "stopped" note and saves the partial
      // reply as soon as the request is aborted.
      toast.success('Generation stopped.')
    } else {
      toast.info('No active generation to stop.')
    }
  }, [isAuthenticated, isConvexStreaming, isLocalStreaming, streamChatId, verifiedConvexMessages, cancelMessage])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        if (isAuthenticated) {
          await deleteConvexChat({ chatId: id as Id<'chats'> })
          toast.success('Chat deleted.')
        } else {
          await deleteGuestConversation(id)
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
