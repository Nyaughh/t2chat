import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const getSettings = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('settings')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .unique()
  },
})

export const updateSettings = mutation({
  args: {
    userId: v.id('users'),
    theme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .unique()

    if (settings) {
      await ctx.db.patch(settings._id, { theme: args.theme })
    }
  },
}) 