// QUERIES - for real-time subscriptions
import { query } from '../_generated/server'
import { v } from 'convex/values'
import { requireOwnedChat, requireOwnedMessage, requireUserId } from './access'

export const getChatMessages = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    await requireOwnedChat(ctx, chatId)

    return await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chatId))
      .order('asc')
      .collect()
  },
})

export const getMessage = query({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }) => {
    await requireUserId(ctx)
    // A deleted message reads as null (the streaming loop polls this while a chat may be deleted)
    if (!(await ctx.db.get(messageId))) {
      return null
    }
    const { message } = await requireOwnedMessage(ctx, messageId)
    return message
  },
})

/**
 * The in-progress text of a reply that is still streaming (null once it
 * finishes). Clients overlay it on the incomplete message from
 * getChatMessages, so streaming progress doesn't re-send the whole chat.
 */
export const getStreamingMessage = query({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }) => {
    await requireUserId(ctx)
    // A deleted message reads as null, like getMessage
    if (!(await ctx.db.get(messageId))) {
      return null
    }
    await requireOwnedMessage(ctx, messageId)

    const streaming = await ctx.db
      .query('streamingMessages')
      .withIndex('by_message', (q) => q.eq('messageId', messageId))
      .first()
    return streaming ? { messageId, content: streaming.content, thinking: streaming.thinking } : null
  },
})

export const getUserChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)

    return await ctx.db
      .query('chats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
  },
})

export const getChat = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    const { chat } = await requireOwnedChat(ctx, chatId)
    return chat
  },
})

// ---------------------------------------------------------------------------
// Shared-chat projection
//
// When an assistant reply uses a tool, convex/chat/shared.ts writes a
// `[TOOL_CALL:<id>]` marker into the reply's content and records the call in
// `toolCalls`. The shared page renders each marker with its call, so a public
// viewer gets an allowlisted copy of each recorded call that keeps only what
// the owner's view visibly shows: the search query and results, the image URL
// and a fixed failure text. Model-written image prompts (shown only as alt
// text, and possibly built from private personalization settings), storage ids,
// key usage, timestamps, raw errors and unknown tools are not published.
//
// Only markers that belong to a recorded call are touched: a recorded call that
// isn't published has its marker removed. Any other `[TOOL_CALL:...]` text, and
// every user message, is returned verbatim.
// ---------------------------------------------------------------------------

const TOOL_MARKER = /\n?\[TOOL_CALL:([^\]\n]*)\]\n?/g

/** Alt text for shared generated images, in place of the private prompt. */
const SHARED_IMAGE_ALT = 'Generated image'

type StoredToolCall = { toolCallId: string; toolName: string; args: any; result?: any }

type SharedToolCall =
  | {
      toolCallId: string
      toolName: 'search'
      args: { query: string }
      result?: { answer?: string; results: { title: string; url: string; content: string }[] }
    }
  | {
      toolCallId: string
      toolName: 'generateImage'
      args: { prompt: string }
      result?: { success: boolean; imageUrl?: string; error?: string }
    }

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

const safeUrl = (value: unknown, protocols: string[]) => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return protocols.includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

const toSharedToolCall = (call: StoredToolCall): SharedToolCall | null => {
  // The page only recognises markers with these ids; other calls aren't published (and their markers are removed)
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(call.toolCallId)) return null
  const toolCallId = call.toolCallId
  const result = call.result && typeof call.result === 'object' ? call.result : undefined

  if (call.toolName === 'search') {
    const items = Array.isArray(result?.results) ? result.results : []
    return {
      toolCallId,
      toolName: 'search',
      // Shown in the owner's view as "Searched the web for: <query>"
      args: { query: str(call.args?.query, 500) },
      ...(result && {
        result: {
          ...(typeof result.answer === 'string' && result.answer && { answer: str(result.answer, 4_000) }),
          results: items.slice(0, 10).flatMap((item: any) => {
            const url = safeUrl(item?.url, ['https:', 'http:'])
            return url ? [{ title: str(item?.title, 300), url, content: str(item?.content, 1_000) }] : []
          }),
        },
      }),
    }
  }

  if (call.toolName === 'generateImage') {
    const imageUrl = result?.success === true ? safeUrl(result.imageUrl, ['https:']) : undefined
    return {
      toolCallId,
      toolName: 'generateImage',
      args: { prompt: SHARED_IMAGE_ALT },
      ...(result && {
        result: imageUrl ? { success: true, imageUrl } : { success: false, error: 'Failed to generate image' },
      }),
    }
  }

  return null
}

/** Display-safe content and tool calls for a shared message. */
const toSharedMessageParts = (
  role: 'user' | 'assistant',
  content: string,
  toolCalls: StoredToolCall[] | undefined,
): { content: string; toolCalls?: SharedToolCall[] } => {
  // Only the server's assistant tool records produce markers; everything else is ordinary text
  if (role !== 'assistant' || !toolCalls || toolCalls.length === 0) {
    return { content }
  }

  const recordedIds = new Set(toolCalls.map((call) => call.toolCallId))
  const shared = toolCalls.map(toSharedToolCall).filter((call): call is SharedToolCall => call !== null)
  const publishedIds = new Set(shared.map((call) => call.toolCallId))

  const cleaned = content.replace(TOOL_MARKER, (marker, id: string) =>
    recordedIds.has(id) && !publishedIds.has(id) ? '\n' : marker,
  )
  const markerIds = new Set([...cleaned.matchAll(TOOL_MARKER)].map((match) => match[1]))
  const used = shared.filter((call) => markerIds.has(call.toolCallId))

  return { content: cleaned, ...(used.length > 0 && { toolCalls: used }) }
}

/**
 * Public read of a shared chat. Returns only what the shared page shows: no
 * owner id, and tool calls only as the display-safe copies above. The chat id
 * is kept because the page's message type requires it; every function that
 * takes a chat id checks ownership, so it grants nothing to a viewer.
 */
export const getSharedChat = query({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }) => {
    if (!shareId || shareId.length > 64) {
      return null
    }

    const chat = await ctx.db
      .query('chats')
      .withIndex('by_share_id', (q) => q.eq('shareId', shareId))
      .first()

    if (!chat || !chat.isShared) {
      return null
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chat._id))
      .order('asc')
      .collect()

    return {
      chat: { title: chat.title, createdAt: chat.createdAt },
      messages: messages.map((m) => ({
        _id: m._id,
        _creationTime: m._creationTime,
        chatId: m.chatId,
        role: m.role,
        ...toSharedMessageParts(m.role, m.content, m.toolCalls),
        modelId: m.modelId,
        thinking: m.thinking,
        thinkingDuration: m.thinkingDuration,
        attachments: m.attachments,
        isComplete: m.isComplete,
        createdAt: m.createdAt,
      })),
    }
  },
})

export const exportAllConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)

    const chats = await ctx.db
      .query('chats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    const allMessages = await Promise.all(
      chats.map((chat) =>
        ctx.db
          .query('messages')
          .withIndex('by_chat_created', (q) => q.eq('chatId', chat._id))
          .collect(),
      ),
    )

    return {
      chats,
      messages: allMessages.flat(),
    }
  },
})
