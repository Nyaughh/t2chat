import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

export const addBotMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
  },
  handler: async (ctx, { conversationId, content }) => {
    await ctx.db.insert('messages', {
      conversationId,
      content,
      role: 'assistant',
    })
  },
}) 