import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    email: v.string(),
    workosId: v.string(),
    tier: v.union(v.literal('Free'), v.literal('Pro')),
    credits: v.number(),
    creditsResetAt: v.optional(v.number()),
  }).index('by_workos_id', ['workosId']),

  conversations: defineTable({
    userId: v.id('users'),
    title: v.string(),
  }).index('by_user_id', ['userId']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    content: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    attachments: v.optional(v.array(v.any())),
  }).index('by_conversation_id', ['conversationId']),

  settings: defineTable({
    userId: v.id('users'),
    theme: v.optional(v.string()),
    // Add other settings as needed
  }).index('by_user_id', ['userId']),
}) 