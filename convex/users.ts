import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'

const FREE_TIER_CREDITS = 20

export const getUserByWorkosId = query({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique()
  },
})

export const getOrCreateUser = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique()

    if (user !== null) {
      return user._id
    }

    const userId = await ctx.db.insert('users', {
      workosId: args.workosId,
      email: args.email,
      tier: 'Free',
      credits: FREE_TIER_CREDITS,
      creditsResetAt: Date.now() + 24 * 60 * 60 * 1000,
    })

    // Also create default settings for the new user
    await ctx.db.insert('settings', {
      userId,
      theme: 'system',
    })

    return userId
  },
})

export const updateUserTier = internalMutation({
  args: { userId: v.id('users'), tier: v.union(v.literal('Free'), v.literal('Pro')) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { tier: args.tier })
  },
})

export const decrementCredits = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (user && user.tier === 'Free' && user.credits > 0) {
      await ctx.db.patch(args.userId, { credits: user.credits - 1 })
    }
  },
})

export const resetCredits = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const usersToReset = await ctx.db
      .query('users')
      .filter((q) => q.and(q.eq(q.field('tier'), 'Free'), q.lt(q.field('creditsResetAt'), now)))
      .collect()

    for (const user of usersToReset) {
      await ctx.db.patch(user._id, {
        credits: FREE_TIER_CREDITS,
        creditsResetAt: now + 24 * 60 * 60 * 1000,
      })
    }
  },
}) 