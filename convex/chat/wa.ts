'use node'
import { v } from 'convex/values'
import { action, mutation, query } from '../_generated/server'
import { api } from '../_generated/api'
import { Id } from '../_generated/dataModel'
import { betterAuthComponent } from '../auth'
import { CoreMessage } from 'ai'
import { generateAIResponse, mapModel } from './shared'

export const sendMessage = action({
  args: {
    chatId: v.id('chats'),
    message: v.string(),
    modelId: v.string(),
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
    webSearch: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { chatId, message, modelId, attachments, webSearch },
  ): Promise<{
    success: boolean
    userMessageId: Id<'messages'>
    assistantMessageId: Id<'messages'>
  }> => {
    // Verify authentication and chat ownership first
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const chat = await ctx.runQuery(api.chat.queries.getChat, { chatId })
    if (!chat) {
      throw new Error('Chat not found or access denied')
    }

    // Get chat history for context
    const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId })

    // Add user message to the database
    const userMessageId: Id<'messages'> = await ctx.runMutation(api.chat.mutations.addMessage, {
      chatId,
      role: 'user',
      content: message,
      attachments,
    })

    // Convert to AI SDK format
    const chatMessages: CoreMessage[] = messages
      .filter((msg: any) => msg.isComplete !== false)
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

    // Add the new user message
    chatMessages.push({
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: message,
        },
        ...(attachments
          ? attachments.map((file) => ({
              type: 'image' as const,
              image: new URL(file.url.replace('blob:', '')),
            }))
          : []),
      ],
    })

    try {
      // Create assistant message placeholder
      const assistantMessageId: Id<'messages'> = await ctx.runMutation(api.chat.mutations.addMessage, {
        chatId,
        role: 'assistant',
        content: '',
        modelId,
        isComplete: false,
      })

      // Generate the AI response using shared function
      await generateAIResponse(ctx, chatMessages, modelId, assistantMessageId, webSearch)

      return {
        success: true,
        userMessageId,
        assistantMessageId,
      }
    } catch (error) {
      console.error('Error in sendMessage action:', error)

      // Add error message to chat
      await ctx.runMutation(api.chat.mutations.addMessage, {
        chatId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your message. Please try again.',
        modelId,
      })

      throw error
    }
  },
})
