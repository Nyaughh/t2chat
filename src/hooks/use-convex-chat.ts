import { useMemo, useRef } from 'react'
import { useAction, useConvexAuth, useMutation, useQueries, useQuery, type RequestForQueries } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'

export const useConvexChat = (chatId?: Id<'chats'>) => {
  const { isAuthenticated, isLoading } = useConvexAuth()

  // First get the user's chats to verify access
  const chats = useQuery(api.chat.queries.getUserChats, isAuthenticated ? {} : 'skip')

  // Only query messages if the chat exists in the user's chats
  const chatExists = useMemo(() => {
    if (!chatId || !chats) return false
    return chats.some((chat) => chat._id === chatId)
  }, [chatId, chats])

  // Queries
  const storedMessages = useQuery(
    api.chat.queries.getChatMessages,
    chatId && isAuthenticated && chatExists ? { chatId } : 'skip',
  )

  // While replies stream, their text lives outside the message list (see
  // convex/chat/streaming.ts): a small row per reply with the open tail, plus
  // immutable segments. Each segment is loaded once; only tails change per
  // update. Overlay the text on every in-progress reply in this chat.
  const streams = useQuery(
    api.chat.streaming.getStreamingMessages,
    chatId && isAuthenticated && chatExists ? { chatId } : 'skip',
  )
  const segmentRequests = useMemo(() => {
    const requests: RequestForQueries = {}
    for (const stream of streams ?? []) {
      for (const kind of ['content', 'thinking'] as const) {
        const count = kind === 'content' ? stream.contentSegments : stream.thinkingSegments
        for (let index = 0; index < count; index++) {
          requests[`${stream.messageId}:${kind}:${index}`] = {
            query: api.chat.streaming.getStreamSegment,
            args: { messageId: stream.messageId, kind, index },
          }
        }
      }
    }
    return requests
  }, [streams])
  const segments = useQueries(segmentRequests)

  // Last complete text per reply, shown while a just-created segment loads
  const lastStreamText = useRef(new Map<string, { content: string; thinking: string }>())
  const messages = useMemo(() => {
    if (!storedMessages || !streams || streams.length === 0) {
      lastStreamText.current.clear()
      return storedMessages
    }
    const byMessage = new Map(streams.map((stream) => [stream.messageId, stream]))
    const assemble = (messageId: string, kind: 'content' | 'thinking', count: number, tail: string) => {
      let text = ''
      for (let index = 0; index < count; index++) {
        const segment = segments[`${messageId}:${kind}:${index}`]
        if (typeof segment !== 'string') return undefined
        text += segment
      }
      return text + tail
    }
    const overlaid = storedMessages.map((message) => {
      const stream = byMessage.get(message._id)
      if (!stream || message.role !== 'assistant' || message.isComplete !== false) return message
      const previous = lastStreamText.current.get(message._id)
      const content = assemble(message._id, 'content', stream.contentSegments, stream.contentTail) ?? previous?.content
      const thinking = assemble(message._id, 'thinking', stream.thinkingSegments, stream.thinkingTail) ?? previous?.thinking
      if (content === undefined) return message
      lastStreamText.current.set(message._id, { content, thinking: thinking ?? '' })
      return { ...message, content, thinking: thinking || message.thinking }
    })
    for (const id of [...lastStreamText.current.keys()]) {
      if (!byMessage.has(id as Id<'messages'>)) lastStreamText.current.delete(id)
    }
    return overlaid
  }, [storedMessages, streams, segments])

  // Mutations & Actions
  const createChat = useMutation(api.chat.mutations.createChat)
  const sendMessage = useAction(api.chat.actions.sendMessage)
  const retryMessage = useAction(api.chat.actions.retryMessage)
  const editMessageAndRegenerate = useAction(api.chat.actions.editMessageAndRegenerate)
  const deleteChat = useMutation(api.chat.mutations.deleteChat)
  const updateChatTitle = useMutation(api.chat.mutations.updateChatTitle)
  const deleteMessagesFromIndex = useMutation(api.chat.mutations.deleteMessagesFromIndex)
  const cancelMessage = useMutation(api.chat.mutations.cancelMessage)
  const editMessage = useMutation(api.chat.mutations.editMessage)

  const isStreaming = useMemo(() => {
    if (!messages) return false
    const lastMessage = messages[messages.length - 1]
    return lastMessage ? lastMessage.role === 'assistant' && !lastMessage.isComplete : false
  }, [messages])

  return {
    // State
    isAuthenticated,
    isLoading,
    isStreaming,
    chatExists,

    // Data
    messages,
    chats,

    // Functions
    createChat,
    sendMessage,
    retryMessage,
    editMessageAndRegenerate,
    deleteChat,
    updateChatTitle,
    deleteMessagesFromIndex,
    cancelMessage,
    editMessage,
  }
}
