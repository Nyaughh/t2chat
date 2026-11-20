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
  toolCallsValidator,
  type Attachment,
} from './access'
import { STOPPED_NOTE, STREAM_EXPIRY_MS, discardStreamArtifacts, getStreamRow, readStreamText } from './streaming'

// MUTATIONS - for database modifications
//
// Public mutations check the session and chat ownership on every call.
// Writes that only the server's own actions should make (assistant
// placeholders, streaming updates, generated titles) are internal mutations.

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

  if (role === 'assistant' && messageData.isComplete === false) {
    await ctx.scheduler.runAfter(STREAM_EXPIRY_MS, internal.chat.streaming.expireStream, { messageId })
  }

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

/**
 * Records changes on a reply that is still open: tool calls while it streams,
 * or an error text that closes it. Internal: only the chat actions write
 * assistant content. A closed reply (finished, stopped or expired) is never
 * changed here; the streamed text's terminal write is chat.streaming.finalizeStream.
 */
export const updateMessage = internalMutation({
  args: {
    messageId: v.id('messages'),
    content: v.optional(v.string()),
    thinking: v.optional(v.string()),
    thinkingDuration: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
    toolCalls: v.optional(toolCallsValidator),
  },
  handler: async (ctx, { messageId, content, thinking, thinkingDuration, isComplete, toolCalls }) => {
    const { message } = await requireOwnedMessage(ctx, messageId)
    if (message.isComplete) {
      return messageId
    }

    const updateData: Partial<Doc<'messages'>> = {}
    if (content !== undefined) updateData.content = content
    if (thinking !== undefined) updateData.thinking = thinking
    if (thinkingDuration !== undefined) updateData.thinkingDuration = thinkingDuration
    if (isComplete !== undefined) updateData.isComplete = isComplete
    if (toolCalls !== undefined) updateData.toolCalls = toolCalls

    await ctx.db.patch(messageId, updateData)
    if (isComplete) {
      await discardStreamArtifacts(ctx, messageId)
    }

    return messageId
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

    // Keep the text shown so far. The action's own final write (more text, same
    // note) is guarded by chat.streaming.finalizeStream, so the note can't be lost.
    const row = await getStreamRow(ctx, messageId)
    const shown = row ? await readStreamText(ctx, row) : { content: message.content, thinking: message.thinking ?? '' }
    await ctx.db.patch(messageId, {
      isCancelled: true,
      isComplete: true,
      content: shown.content + STOPPED_NOTE,
      ...(shown.thinking && { thinking: shown.thinking }),
    })
    await discardStreamArtifacts(ctx, messageId)

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
    const { message } = await requireOwnedMessage(ctx, messageId)
    await deleteMessageDoc(ctx, message)
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
      await deleteMessageDoc(ctx, message)
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
    await purgeMessagePage(ctx, chatId)

    return { success: true }
  },
})

export const deleteAllConversations = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    // Only chats that exist now: a chat created after this request (including an
    // import with an old createdAt) has a later _creationTime and is kept.
    await deleteChatPage(ctx, userId, Date.now())
    return { success: true }
  },
})

// ---------------------------------------------------------------------------
// Bounded deletes
//
// Deleting a large chat (or every chat) in one transaction can exceed Convex's
// per-transaction limits (16 MiB read, 8,192 documents written). Chats are
// removed first, so they vanish from the UI at once, and their messages are
// deleted in pages by internal mutations that reschedule themselves.
//
// A page reads messages a few at a time and stops before the next small read
// could pass the read budget, whatever the message sizes (each document is at
// most 1 MiB), and before the write cap.
// ---------------------------------------------------------------------------

const MAX_DOC_BYTES = 1 << 20
const READ_LIMIT_BYTES = 14 * MAX_DOC_BYTES // headroom under Convex's 16 MiB
const READ_STEP = 8
const MAX_DELETES_PER_PAGE = 2_000
const CHAT_DELETE_BATCH = 100

const encoder = new TextEncoder()
const docBytes = (doc: unknown) => encoder.encode(JSON.stringify(doc)).length

/** Deletes a message; an in-progress reply's stream is discarded by a scheduled job (unbounded size). */
const deleteMessageDoc = async (ctx: MutationCtx, message: Doc<'messages'>) => {
  if (message.isComplete === false) {
    await ctx.scheduler.runAfter(0, internal.chat.streaming.discardStream, { messageId: message._id })
  }
  await ctx.db.delete(message._id)
}

/**
 * Deletes one page of a chat's messages within the read and write budgets and
 * schedules the next page if any remain. Returns the bytes read (for tests).
 */
const purgeMessagePage = async (ctx: MutationCtx, chatId: Id<'chats'>) => {
  let bytesRead = 0
  let deleted = 0
  while (bytesRead + READ_STEP * MAX_DOC_BYTES <= READ_LIMIT_BYTES && deleted + READ_STEP <= MAX_DELETES_PER_PAGE) {
    const step = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chatId))
      .take(READ_STEP)
    for (const message of step) {
      bytesRead += docBytes(message)
      await deleteMessageDoc(ctx, message)
      deleted++
    }
    if (step.length < READ_STEP) {
      return { bytesRead, deleted, more: false }
    }
  }
  await ctx.scheduler.runAfter(0, internal.chat.mutations.purgeChatMessages, { chatId })
  return { bytesRead, deleted, more: true }
}

/** Deletes one batch of a user's chats created at or before `before`, then schedules the rest. */
const deleteChatPage = async (ctx: MutationCtx, userId: Id<'users'>, before: number) => {
  const chats = await ctx.db
    .query('chats')
    .withIndex('by_user', (q) => q.eq('userId', userId).lte('_creationTime', before))
    .take(CHAT_DELETE_BATCH)
  for (const chat of chats) {
    await ctx.db.delete(chat._id)
    await ctx.scheduler.runAfter(0, internal.chat.mutations.purgeChatMessages, { chatId: chat._id })
  }
  if (chats.length === CHAT_DELETE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.chat.mutations.purgeUserChats, { userId, before })
  }
}

/** Internal: continues deleting the messages of an already-deleted chat. */
export const purgeChatMessages = internalMutation({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    // Only ever purge messages whose chat is gone
    if (await ctx.db.get(chatId)) return null
    return await purgeMessagePage(ctx, chatId)
  },
})

/** Internal: continues deleteAllConversations for the chats that existed when it was requested. */
export const purgeUserChats = internalMutation({
  args: { userId: v.id('users'), before: v.number() },
  handler: async (ctx, { userId, before }) => {
    await deleteChatPage(ctx, userId, before)
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
