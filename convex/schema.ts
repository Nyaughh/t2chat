import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
  }).index('by_token', ['tokenIdentifier']),

  userSettings: defineTable({
    userId: v.id('users'),
    uploadthing_key: v.optional(v.string()),
    tavily_key: v.optional(v.string()),
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
    disabledModels: v.optional(v.array(v.string())), // Array of disabled model IDs
  }).index('by_user', ['userId']),

  apiKeys: defineTable({
    userId: v.id('users'),
    service: v.union(v.literal('gemini'), v.literal('groq'), v.literal('openrouter'), v.literal('deepgram')),
    name: v.string(),
    key: v.string(),
    is_default: v.optional(v.boolean()),
  }).index('by_user_and_service', ['userId', 'service']),

  chats: defineTable({
    userId: v.id('users'),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    shareId: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
    isGeneratingTitle: v.optional(v.boolean()),
    isBranch: v.optional(v.boolean()),
  })
    .index('by_user', ['userId'])
    .index('by_share_id', ['shareId']),

  messages: defineTable({
    chatId: v.id('chats'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    modelId: v.optional(v.string()),
    thinking: v.optional(v.string()), // Store reasoning content separately
    thinkingDuration: v.optional(v.number()), // Store thinking duration in seconds
    isComplete: v.optional(v.boolean()), // For streaming messages
    isCancelled: v.optional(v.boolean()), // For cancelling streaming messages
    attachments: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          size: v.number(),
          url: v.string(),
        }),
      ),
    ),
    toolCalls: v.optional(
      v.array(
        v.object({
          toolCallId: v.string(),
          toolName: v.string(),
          args: v.any(),
          result: v.optional(v.any()),
        }),
      ),
    ),
    processedThinking: v.optional(v.any()), // Processed thinking insights
    metadata: v.optional(v.any()), // Message metadata from workers
    createdAt: v.number(),
  })
    .index('by_chat', ['chatId'])
    .index('by_chat_created', ['chatId', 'createdAt']),

  // AI Generation Tasks for background processing
  aiGenerationTasks: defineTable({
    type: v.string(), // Task type: 'generate_response', 'generate_title', etc.
    payload: v.any(), // Task-specific data
    priority: v.number(), // Task priority (1-10, higher = more priority)
    status: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    createdAt: v.number(),
    scheduledFor: v.number(), // When to process this task
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    retryCount: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_scheduled', ['scheduledFor'])
    .index('by_priority', ['priority']),
})
