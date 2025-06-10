import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { api, internal } from './_generated/api'

export const list = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('conversations')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const conversationId = await ctx.db.insert('conversations', {
      userId: args.userId,
      title: 'New Chat',
    })
    return conversationId
  },
})

export const remove = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_id', (q) => q.eq('conversationId', args.conversationId))
      .collect()

    await Promise.all(messages.map((message) => ctx.db.delete(message._id)))

    await ctx.db.delete(args.conversationId)
  },
})

export const createAndAddFirstMessage = mutation({
  args: { 
    userId: v.id('users'), 
    content: v.string(), 
    attachments: v.optional(v.array(v.any())) 
  },
  handler: async (ctx, args) => {
    const title = args.content.split(' ').slice(0, 4).join(' ');
    const conversationId = await ctx.db.insert('conversations', {
      userId: args.userId,
      title: title,
    });
    
    await ctx.db.insert('messages', {
      conversationId,
      content: args.content,
      role: 'user',
      attachments: args.attachments,
    });
    
    // Schedule the bot to respond
    await ctx.scheduler.runAfter(0, internal.messages.chat, {
        userId: args.userId,
        conversationId,
        message: args.content,
    });

    return conversationId;
  },
}); 