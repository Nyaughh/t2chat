'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { generateAIResponse } from './shared'
import { ModelMessage } from 'ai'

export const sendMessage = action({
  args: {
    chatMessages: v.array(v.any()),
    modelId: v.string(),
    assistantMessageId: v.id('messages'),
    attachments: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        size: v.number(),
        url: v.string(),
      }),
    ),
    userMessageId: v.id('messages'),
    webSearch: v.optional(v.boolean()),
    imageGen: v.optional(v.boolean()),
    message: v.string(),
  },
  handler: async (
    ctx,
    { chatMessages, modelId, assistantMessageId, webSearch, userMessageId, attachments, message, imageGen },
  ): Promise<{
    success: boolean
    userMessageId: Id<'messages'>
    assistantMessageId: Id<'messages'>
  }> => {
    chatMessages.push({
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: message,
        },
        ...attachments.map((file) => ({
          type: 'file' as const,
          data: new URL(file.url.replace('blob:', '')),
          mediaType: file.type,
          filename: file.name,
        })),
      ],
    })

    await generateAIResponse(ctx, chatMessages as ModelMessage[], modelId, assistantMessageId, webSearch, true)

    return {
      success: true,
      userMessageId,
      assistantMessageId,
    }
  },
})
