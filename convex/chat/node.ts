'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { generateAIResponse } from './shared'
import { ModelMessage } from 'ai'
import { attachmentValidator, assertValidAttachments, requireUserId } from './access'

/**
 * Generates a reply for a message with attachments (or image generation) in
 * the Node runtime. Internal: only `chat.actions.sendMessage` calls it, after
 * it has checked the session and chat ownership and created both messages.
 * The caller's session is propagated, so the checks below still apply.
 */
export const sendMessage = internalAction({
  args: {
    chatMessages: v.array(v.any()),
    modelId: v.string(),
    assistantMessageId: v.id('messages'),
    attachments: v.array(attachmentValidator),
    userMessageId: v.id('messages'),
    webSearch: v.optional(v.boolean()),
    imageGen: v.optional(v.boolean()),
    message: v.string(),
  },
  handler: async (
    ctx,
    { chatMessages, modelId, assistantMessageId, webSearch, userMessageId, attachments, message },
  ): Promise<{
    success: boolean
    userMessageId: Id<'messages'>
    assistantMessageId: Id<'messages'>
  }> => {
    // Defense in depth: never generate without a signed-in caller or with foreign URLs
    await requireUserId(ctx)
    assertValidAttachments(attachments)

    chatMessages.push({
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: message,
        },
        ...attachments.map((file) => ({
          type: 'file' as const,
          data: new URL(file.url),
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
