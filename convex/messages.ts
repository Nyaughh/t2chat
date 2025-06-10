import { v } from 'convex/values'
import { mutation, query, internalAction } from './_generated/server'
import { internal } from './_generated/api'

export const listMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', (q) => q.eq('conversationId', args.conversationId))
      .collect()
  },
})

export const addMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    attachments: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      content: args.content,
      role: args.role,
      attachments: args.attachments,
    })
  },
})

export const migrateMessages = mutation({
  args: {
    userId: v.id('users'),
    messages: v.array(
      v.object({
        content: v.string(),
        role: v.union(v.literal('user'), v.literal('assistant')),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const firstMessage = args.messages[0]?.content || 'Untitled Import'
    const title = firstMessage.split(' ').slice(0, 4).join(' ')
    const conversationId = await ctx.db.insert('conversations', {
      userId: args.userId,
      title: title,
    })

    for (const message of args.messages) {
      await ctx.db.insert('messages', {
        conversationId: conversationId,
        content: message.content,
        role: message.role,
      })
    }
  },
})

export const chat = internalAction({
  args: {
    userId: v.id('users'),
    conversationId: v.id('conversations'),
    message: v.string(),
  },
  handler: async (ctx, { userId, conversationId, message }) => {
    // This will be implemented later with Gemini API
    console.log('Received message from user:', userId, message)

    // Simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Add a dummy assistant message
    await ctx.runMutation(internal.bot.addBotMessage, {
      conversationId: conversationId,
      content: 'This is a response from the bot.',
    })
  },
})
