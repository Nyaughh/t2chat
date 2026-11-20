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

/**
 * Public read of a shared chat. Returns only what the shared page shows: no
 * owner id and no tool-call payloads. The chat id is kept because the page's
 * message type requires it; every function that takes a chat id checks
 * ownership, so it grants nothing to a viewer.
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
        content: m.content,
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
          .withIndex('by_chat', (q) => q.eq('chatId', chat._id))
          .collect(),
      ),
    )

    return {
      chats,
      messages: allMessages.flat(),
    }
  },
})
