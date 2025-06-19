'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { generateAIResponse } from './shared'
import { CoreMessage } from 'ai'

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
    console.log('attachments', attachments)

    const getFileType = (file: { type: string }) => {
      if (file.type.startsWith('image')) {
        return 'image'
      }
      return 'file'
    }

    chatMessages.push({
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: message,
        },
        ...attachments.map((file) => ({
          type: getFileType(file),
          [getFileType(file)]: new URL(file.url.replace('blob:', '')),
        })),
      ],
    })

    await generateAIResponse(ctx, chatMessages as CoreMessage[], modelId, assistantMessageId, webSearch, true)

    return {
      success: true,
      userMessageId,
      assistantMessageId,
    }
  },
})
