import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { betterAuthComponent } from './auth'
import { Id } from './_generated/dataModel'

export const updateUserSettings = mutation({
  args: {
    userName: v.optional(v.string()),
    userRole: v.optional(v.string()),
    userTraits: v.optional(v.array(v.string())),
    userAdditionalInfo: v.optional(v.string()),
    promptTemplate: v.optional(v.string()),
    mainFont: v.optional(
      v.union(v.literal('inter'), v.literal('system'), v.literal('serif'), v.literal('mono'), v.literal('roboto-slab')),
    ),
    codeFont: v.optional(
      v.union(
        v.literal('fira-code'),
        v.literal('mono'),
        v.literal('consolas'),
        v.literal('jetbrains'),
        v.literal('source-code-pro'),
      ),
    ),
    sendBehavior: v.optional(v.union(v.literal('enter'), v.literal('shiftEnter'), v.literal('button'))),
    autoSave: v.optional(v.boolean()),
    showTimestamps: v.optional(v.boolean()),
    uploadthing_key: v.optional(v.string()),
    tavily_key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .unique()

    if (settings) {
      await ctx.db.patch(settings._id, args)
    } else {
      await ctx.db.insert('userSettings', { userId: userId as Id<'users'>, ...args })
    }
  },
})

export const getMySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .unique()
  },
})
