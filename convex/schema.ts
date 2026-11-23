import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { appearanceValidator } from './appearanceValidator'

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  }).index('by_token', ['email']),

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
    autoSave: v.optional(v.boolean()), // Deprecated. Existing settings may contain this field.
    showTimestamps: v.optional(v.boolean()),
    disabledModels: v.optional(v.array(v.string())), // Array of disabled model IDs
    disabledProviders: v.optional(v.array(v.string())), // Providers hidden from the model picker
    showOnlyAvailableModels: v.optional(v.boolean()), // Hide models the user can't currently use
    selectedModelId: v.optional(v.string()), // Last model picked in the composer
    appearance: v.optional(appearanceValidator), // Theme, fonts, sizes (convex/appearance.ts)
  }).index('by_user', ['userId']),

  // Daily request counters for models running on the server's API keys (convex/serverQuota.ts).
  // key: `user:<userId>:<modelId>`, `guest:<subject>:<modelId>` or `global:<modelId>`
  serverUsage: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_key', ['key']),

  // A server-key model paused after the provider returned a rate limit / quota error.
  modelCooldowns: defineTable({
    modelId: v.string(),
    until: v.number(),
  }).index('by_model', ['modelId']),

  apiKeys: defineTable({
    userId: v.id('users'),
    service: v.union(
      v.literal('gemini'),
      v.literal('groq'),
      v.literal('openrouter'),
      v.literal('anthropic'),
      v.literal('openai'),
      v.literal('deepgram'),
    ),
    name: v.string(),
    key: v.string(), // AES-GCM ciphertext ("enc:v1:..."); older rows may still be plain text
    keyHint: v.optional(v.string()), // last 4 characters, shown in settings
    is_default: v.optional(v.boolean()),
  }).index('by_user_and_service', ['userId', 'service']),

  // Gemini read-aloud usage per user, for the /tts rate limits (recent requests only).
  ttsUsage: defineTable({
    userId: v.id('users'),
    requests: v.array(v.object({ at: v.number(), chars: v.number() })),
  }).index('by_user', ['userId']),

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
    createdAt: v.number(),
  }).index('by_chat_created', ['chatId', 'createdAt']),

  // In-progress text of an assistant reply while it streams (see
  // convex/chat/streaming.ts). Kept apart from `messages` so progress writes
  // don't invalidate the chat's message list. Text is append-only: full
  // segments move to immutable `streamSegments` rows and only the short open
  // tail changes on each write, so every update stays small. Everything is
  // removed when the final text is written to the message.
  streamingMessages: defineTable({
    messageId: v.id('messages'),
    chatId: v.id('chats'),
    contentTail: v.string(),
    contentSegments: v.number(),
    contentLength: v.number(),
    thinkingTail: v.string(),
    thinkingSegments: v.number(),
    thinkingLength: v.number(),
    updatedAt: v.number(),
  })
    .index('by_message', ['messageId'])
    .index('by_chat', ['chatId']),

  streamSegments: defineTable({
    messageId: v.id('messages'),
    kind: v.union(v.literal('content'), v.literal('thinking')),
    index: v.number(),
    text: v.string(),
  }).index('by_message_kind_index', ['messageId', 'kind', 'index']),
})
