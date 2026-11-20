import { internalMutation, mutation, type MutationCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import { ConvexError, v } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'
import { models, DEFAULT_MODEL_ID, getProviderDisplayName } from '../../src/lib/models'
import {
  MAX_MESSAGE_CHARS,
  MAX_MIGRATED_CHATS,
  MAX_MIGRATED_MESSAGES,
  MAX_TITLE_CHARS,
  assertMaxLength,
  assertValidAttachments,
  attachmentValidator,
  cleanTitle,
  requireOwnedChat,
  requireOwnedMessage,
  requireUserId,
  type Attachment,
} from './access'

// MUTATIONS - for database modifications
//
// Public mutations check the session and chat ownership on every call.
// Writes that only the server's own actions should make (assistant
// placeholders, streaming updates, generated titles) are internal mutations.

const toolCallsValidator = v.array(
  v.object({
    toolCallId: v.string(),
    toolName: v.string(),
    args: v.any(),
    result: v.optional(v.any()),
  }),
)

export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)

    const now = Date.now()
    const chatId = await ctx.db.insert('chats', {
      userId,
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
      isGeneratingTitle: false,
    })

    return chatId
  },
})

type NewMessage = {
  chatId: Id<'chats'>
  role: 'user' | 'assistant'
  content: string
  modelId?: string
  thinking?: string
  thinkingDuration?: number
  isComplete?: boolean
  attachments?: Attachment[]
}

/** Inserts a message into a chat the signed-in user owns, after the shared checks. */
const insertOwnedMessage = async (ctx: MutationCtx, args: NewMessage) => {
  const { chatId, role, content, modelId, thinking, thinkingDuration, isComplete, attachments } = args
  const { chat } = await requireOwnedChat(ctx, chatId)

  assertMaxLength(content, MAX_MESSAGE_CHARS, 'Message')
  assertValidAttachments(attachments)

  // Models that only run on the user's own key need that key before generating
  if (modelId && role === 'assistant') {
    const modelInfo = models.find((m) => m.id === modelId)
    if (modelInfo && modelInfo.isApiKeyOnly) {
      const userKey = await ctx.db
        .query('apiKeys')
        .withIndex('by_user_and_service', (q) => q.eq('userId', chat.userId).eq('service', modelInfo.provider))
        .first()

      if (!userKey) {
        throw new ConvexError(
          `Using ${modelInfo.name} requires you to add a valid ${getProviderDisplayName(modelInfo.provider)} API key in settings.`,
        )
      }
    }
  }

  const messageData: Omit<Doc<'messages'>, '_id' | '_creationTime'> = {
    chatId,
    role,
    content,
    modelId,
    thinking,
    thinkingDuration,
    createdAt: Date.now(),
    isComplete: isComplete ?? true,
  }

  if (attachments) {
    messageData.attachments = attachments
  }

  // The first user message of a new chat starts title generation
  if (role === 'user' && chat.title === 'New chat' && !chat.isGeneratingTitle) {
    const existingUserMessage = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chatId))
      .filter((q) => q.eq(q.field('role'), 'user'))
      .first()

    if (!existingUserMessage) {
      await ctx.db.patch(chatId, { isGeneratingTitle: true })
      await ctx.scheduler.runAfter(0, internal.chat.actions.generateTitle, {
        chatId,
        messageContent: content,
        modelId: modelId || DEFAULT_MODEL_ID,
      })
    }
  }

  const messageId = await ctx.db.insert('messages', messageData)

  await ctx.db.patch(chatId, {
    updatedAt: Date.now(),
  })

  return messageId
}

/**
 * Adds a finished message to one of the caller's chats. Used by the client to
 * save voice conversations, so it accepts both roles, but only complete messages.
 */
export const addMessage = mutation({
  args: {
    chatId: v.id('chats'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    modelId: v.optional(v.string()),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    return insertOwnedMessage(ctx, { ...args, isComplete: true })
  },
})

/** Server-side insert used by the chat actions (user turns and assistant placeholders). */
export const insertMessage = internalMutation({
  args: {
    chatId: v.id('chats'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    modelId: v.optional(v.string()),
    thinking: v.optional(v.string()),
    thinkingDuration: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    return insertOwnedMessage(ctx, args)
  },
})

export const STOPPED_NOTE = '\n\n*Generation was stopped by user.*'

const getStreamingRow = (ctx: MutationCtx, messageId: Id<'messages'>) =>
  ctx.db
    .query('streamingMessages')
    .withIndex('by_message', (q) => q.eq('messageId', messageId))
    .first()

/**
 * Updates a message. Internal: only the chat actions write assistant content.
 * Used for the final text (isComplete: true), which also removes the reply's
 * streaming row, and for the rare in-progress writes that must land on the
 * message itself (tool calls). The ownership check still runs against the
 * action's (propagated) session.
 */
export const updateMessage = internalMutation({
  args: {
    messageId: v.id('messages'),
    content: v.optional(v.string()),
    thinking: v.optional(v.string()),
    thinkingDuration: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
    isCancelled: v.optional(v.boolean()),
    toolCalls: v.optional(toolCallsValidator),
  },
  handler: async (ctx, { messageId, content, thinking, thinkingDuration, isComplete, isCancelled, toolCalls }) => {
    await requireOwnedMessage(ctx, messageId)

    const updateData: Partial<Doc<'messages'>> = {}
    if (content !== undefined) updateData.content = content
    if (thinking !== undefined) updateData.thinking = thinking
    if (thinkingDuration !== undefined) updateData.thinkingDuration = thinkingDuration
    if (isComplete !== undefined) updateData.isComplete = isComplete
    if (isCancelled !== undefined) updateData.isCancelled = isCancelled
    if (toolCalls !== undefined) updateData.toolCalls = toolCalls

    await ctx.db.patch(messageId, updateData)

    // The final text now lives on the message: drop the in-progress copy in the same transaction
    if (isComplete) {
      const streaming = await getStreamingRow(ctx, messageId)
      if (streaming) await ctx.db.delete(streaming._id)
    }

    return messageId
  },
})

/**
 * Records a streaming reply's progress (internal, called by the chat actions
 * about every 150 ms). Writes only the small streaming row, never the message,
 * so the chat's message list isn't re-sent on every tick. Returns whether the
 * user stopped the reply, so the action needs no separate polling query.
 */
export const writeStreamProgress = internalMutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
    thinking: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, content, thinking }): Promise<{ cancelled: boolean }> => {
    const { message } = await requireOwnedMessage(ctx, messageId)
    if (message.isCancelled || message.isComplete) {
      return { cancelled: !!message.isCancelled }
    }

    const streaming = await getStreamingRow(ctx, messageId)
    if (streaming) {
      await ctx.db.patch(streaming._id, { content, thinking, updatedAt: Date.now() })
    } else {
      await ctx.db.insert('streamingMessages', { messageId, content, thinking, updatedAt: Date.now() })
    }
    return { cancelled: false }
  },
})

export const cancelMessage = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, { messageId }) => {
    const { message } = await requireOwnedMessage(ctx, messageId)

    // Only allow cancellation of incomplete assistant messages
    if (message.role !== 'assistant' || message.isComplete) {
      throw new ConvexError('Cannot cancel this message')
    }

    // Keep what was streamed so far (it lives on the streaming row until the reply finishes)
    const streaming = await getStreamingRow(ctx, messageId)
    await ctx.db.patch(messageId, {
      isCancelled: true,
      isComplete: true,
      content: (streaming?.content ?? message.content) + STOPPED_NOTE,
      ...(streaming?.thinking !== undefined && { thinking: streaming.thinking }),
    })
    if (streaming) await ctx.db.delete(streaming._id)

    return messageId
  },
})

export const editMessage = mutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
  },
  handler: async (ctx, { messageId, content }) => {
    const { message } = await requireOwnedMessage(ctx, messageId)
    assertMaxLength(content, MAX_MESSAGE_CHARS, 'Message')

    // Only allow editing user messages
    if (message.role !== 'user') {
      throw new ConvexError('Only user messages can be edited')
    }

    await ctx.db.patch(messageId, { content })

    await ctx.db.patch(message.chatId, {
      updatedAt: Date.now(),
    })

    return messageId
  },
})

/** Replaces a user message's text before regenerating. Internal: used by editMessageAndRegenerate. */
export const setUserMessageContent = internalMutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
  },
  handler: async (ctx, { messageId, content }) => {
    const { message } = await requireOwnedMessage(ctx, messageId)
    assertMaxLength(content, MAX_MESSAGE_CHARS, 'Message')
    if (message.role !== 'user') {
      throw new ConvexError('Only user messages can be edited')
    }
    await ctx.db.patch(messageId, { content })
  },
})

export const deleteMessage = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, { messageId }) => {
    await requireOwnedMessage(ctx, messageId)
    await ctx.db.delete(messageId)
    return { success: true }
  },
})

export const deleteMessagesFromIndex = mutation({
  args: {
    chatId: v.id('chats'),
    fromMessageId: v.id('messages'),
  },
  handler: async (ctx, { chatId, fromMessageId }) => {
    await requireOwnedChat(ctx, chatId)

    const fromMessage = await ctx.db.get(fromMessageId)
    if (!fromMessage || fromMessage.chatId !== chatId) {
      throw new ConvexError('Message not found in chat')
    }

    // Only the tail of the chat (display order), not the whole history
    const tail = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chatId).gte('createdAt', fromMessage.createdAt))
      .order('asc')
      .collect()

    const fromIndex = tail.findIndex((msg) => msg._id === fromMessageId)
    const messagesToDelete = tail.slice(fromIndex)
    for (const message of messagesToDelete) {
      await deleteMessageAndStreamingRow(ctx, message)
    }

    return { success: true, deletedCount: messagesToDelete.length }
  },
})

/** Renames one of the caller's chats (kept for existing clients; same rules as renameChat). */
export const updateChatTitle = mutation({
  args: {
    chatId: v.id('chats'),
    title: v.string(),
  },
  handler: async (ctx, { chatId, title }) => {
    await requireOwnedChat(ctx, chatId)
    await ctx.db.patch(chatId, { title: cleanTitle(title), isGeneratingTitle: false })
  },
})

/**
 * Stores a generated title. Internal: called by the scheduled generateTitle
 * action, which runs without a session. Never overwrites a title the user set
 * in the meantime.
 */
export const setGeneratedTitle = internalMutation({
  args: {
    chatId: v.id('chats'),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { chatId, title }) => {
    const chat = await ctx.db.get(chatId)
    if (!chat) return
    if (title && chat.title === 'New chat') {
      await ctx.db.patch(chatId, { title: cleanTitle(title), isGeneratingTitle: false })
    } else if (chat.isGeneratingTitle) {
      await ctx.db.patch(chatId, { isGeneratingTitle: false })
    }
  },
})

export const deleteChat = mutation({
  args: {
    chatId: v.id('chats'),
  },
  handler: async (ctx, { chatId }) => {
    await requireOwnedChat(ctx, chatId)

    // The chat disappears now; its messages (no longer reachable) go in bounded batches
    await ctx.db.delete(chatId)
    await purgeMessageBatch(ctx, chatId)

    return { success: true }
  },
})

export const deleteAllConversations = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    await deleteChatBatch(ctx, userId)
    return { success: true }
  },
})

// ---------------------------------------------------------------------------
// Bounded deletes
//
// Deleting a large chat (or every chat) in one transaction can exceed Convex's
// per-transaction read/write limits. Chats are removed first (so they vanish
// from the UI at once) and their messages are deleted in batches by internal
// mutations that reschedule themselves until nothing is left.
// ---------------------------------------------------------------------------

const MESSAGE_DELETE_BATCH = 500
const CHAT_DELETE_BATCH = 100

/** Deletes a message, plus its streaming row if it was still in progress. */
const deleteMessageAndStreamingRow = async (ctx: MutationCtx, message: Doc<'messages'>) => {
  if (message.isComplete === false) {
    const streaming = await getStreamingRow(ctx, message._id)
    if (streaming) await ctx.db.delete(streaming._id)
  }
  await ctx.db.delete(message._id)
}

/** Deletes one batch of a chat's messages and schedules the next batch if more remain. */
const purgeMessageBatch = async (ctx: MutationCtx, chatId: Id<'chats'>) => {
  const batch = await ctx.db
    .query('messages')
    .withIndex('by_chat_created', (q) => q.eq('chatId', chatId))
    .take(MESSAGE_DELETE_BATCH)
  for (const message of batch) {
    await deleteMessageAndStreamingRow(ctx, message)
  }
  if (batch.length === MESSAGE_DELETE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.chat.mutations.purgeChatMessages, { chatId })
  }
}

/** Deletes one batch of a user's chats (scheduling their messages) and schedules the next batch. */
const deleteChatBatch = async (ctx: MutationCtx, userId: Id<'users'>) => {
  const chats = await ctx.db
    .query('chats')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(CHAT_DELETE_BATCH)
  for (const chat of chats) {
    await ctx.db.delete(chat._id)
    await ctx.scheduler.runAfter(0, internal.chat.mutations.purgeChatMessages, { chatId: chat._id })
  }
  if (chats.length === CHAT_DELETE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.chat.mutations.purgeUserChats, { userId })
  }
}

/** Internal: continues deleting the messages of an already-deleted chat. */
export const purgeChatMessages = internalMutation({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    // Only ever purge messages whose chat is gone
    if (await ctx.db.get(chatId)) return
    await purgeMessageBatch(ctx, chatId)
  },
})

/** Internal: continues deleting a user's chats for deleteAllConversations. */
export const purgeUserChats = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await deleteChatBatch(ctx, userId)
  },
})

export const migrateAnonymousChats = mutation({
  args: {
    chats: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        lastMessageAt: v.number(),
      }),
    ),
    messages: v.array(
      v.object({
        id: v.string(),
        conversationId: v.string(),
        content: v.string(),
        role: v.union(v.literal('user'), v.literal('assistant')),
        createdAt: v.number(),
        model: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { chats, messages }) => {
    const userId = await requireUserId(ctx)

    if (chats.length > MAX_MIGRATED_CHATS || messages.length > MAX_MIGRATED_MESSAGES) {
      throw new ConvexError(
        `Too much to import at once (max ${MAX_MIGRATED_CHATS} chats and ${MAX_MIGRATED_MESSAGES.toLocaleString('en-US')} messages).`,
      )
    }
    for (const message of messages) {
      assertMaxLength(message.content, MAX_MESSAGE_CHARS, 'Message')
    }

    const migratedChatIds: { [key: string]: Id<'chats'> } = {}

    for (const chat of chats) {
      const newChatId = await ctx.db.insert('chats', {
        userId,
        title: cleanTitle(chat.title),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })
      migratedChatIds[chat.id] = newChatId
    }

    for (const message of messages) {
      const newChatId = migratedChatIds[message.conversationId]
      if (newChatId) {
        await ctx.db.insert('messages', {
          chatId: newChatId,
          role: message.role,
          content: message.content,
          modelId: message.model?.slice(0, 200),
          createdAt: message.createdAt,
          isComplete: true,
        })
      }
    }

    return { success: true, migratedCount: chats.length }
  },
})

export const renameChat = mutation({
  args: {
    chatId: v.id('chats'),
    title: v.string(),
  },
  handler: async (ctx, { chatId, title }) => {
    await requireOwnedChat(ctx, chatId)
    assertMaxLength(title.trim(), MAX_TITLE_CHARS, 'Title')
    await ctx.db.patch(chatId, { title: cleanTitle(title) })
  },
})

/** A 128-bit random, URL-safe share id. */
const newShareId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const shareChat = mutation({
  args: {
    chatId: v.id('chats'),
  },
  handler: async (ctx, { chatId }) => {
    const { chat } = await requireOwnedChat(ctx, chatId)

    // Re-sharing keeps the existing link working
    if (chat.isShared && chat.shareId) {
      return chat.shareId
    }

    const shareId = newShareId()
    await ctx.db.patch(chatId, { isShared: true, shareId })
    return shareId
  },
})

/** Turns sharing off. The old link stops working, and sharing again creates a new link. */
export const unshareChat = mutation({
  args: {
    chatId: v.id('chats'),
  },
  handler: async (ctx, { chatId }) => {
    await requireOwnedChat(ctx, chatId)
    await ctx.db.patch(chatId, { isShared: false, shareId: undefined })
  },
})

export const branchChat = mutation({
  args: {
    chatId: v.id('chats'),
    messageId: v.id('messages'),
  },
  handler: async (ctx, { chatId, messageId }) => {
    const { userId, chat: originalChat } = await requireOwnedChat(ctx, chatId)

    const messagesToCopy = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chatId))
      .order('asc')
      .collect()

    const messageToBranchFromIndex = messagesToCopy.findIndex((m) => m._id === messageId)
    if (messageToBranchFromIndex === -1) {
      throw new ConvexError('Message not found in chat')
    }

    const messagesForNewChat = messagesToCopy.slice(0, messageToBranchFromIndex + 1)

    const now = Date.now()
    const newChatId = await ctx.db.insert('chats', {
      userId,
      title: cleanTitle(`Branch of ${originalChat.title}`),
      createdAt: now,
      updatedAt: now,
      isBranch: true,
    })

    for (const message of messagesForNewChat) {
      const { _id, _creationTime, ...messageData } = message
      await ctx.db.insert('messages', {
        ...messageData,
        chatId: newChatId,
      })
    }

    return newChatId
  },
})
