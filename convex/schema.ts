import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Fields are optional
  }),
  
  chats: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  
  messages: defineTable({
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    modelId: v.optional(v.string()),
    thinking: v.optional(v.string()), // Store reasoning content separately
    thinkingDuration: v.optional(v.number()), // Store thinking duration in seconds
    createdAt: v.number(),
    isComplete: v.optional(v.boolean()), // For streaming messages
  }).index("by_chat", ["chatId"])
    .index("by_chat_created", ["chatId", "createdAt"]),
});