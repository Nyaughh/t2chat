import { v } from 'convex/values'
import { action, internalAction, type ActionCtx } from '../_generated/server'
import { api, internal } from '../_generated/api'
import { Doc, Id } from '../_generated/dataModel'
import { generateText, ModelMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateAIResponse } from './shared'
import { TITLE_MODEL_ID } from '../../src/lib/models'
import { describeProviderError } from '../../src/lib/provider-errors'
import { MAX_MESSAGE_CHARS, assertMaxLength, assertValidAttachments, attachmentValidator, requireUserId } from './access'

// Every public action checks the session first and then reads the chat through
// the owner-checked queries (the session is propagated to runQuery/runMutation).

const toModelMessages = (messages: Doc<'messages'>[]): ModelMessage[] =>
  messages
    .filter((msg) => msg.isComplete !== false)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

/**
 * Records a failure on the assistant placeholder instead of adding a second
 * assistant message. Without a placeholder it falls back to a new message.
 */
const recordFailure = async (
  ctx: ActionCtx,
  chatId: Id<'chats'>,
  assistantMessageId: Id<'messages'> | undefined,
  note: string,
  modelId: string,
) => {
  try {
    if (assistantMessageId) {
      await ctx.runMutation(internal.chat.mutations.updateMessage, {
        messageId: assistantMessageId,
        content: note,
        isComplete: true,
      })
    } else {
      await ctx.runMutation(internal.chat.mutations.insertMessage, {
        chatId,
        role: 'assistant',
        content: note,
        modelId,
      })
    }
  } catch (error) {
    console.warn('Failed to record the error on the chat:', error)
  }
}

export const retryMessage = action({
  args: {
    chatId: v.id('chats'),
    fromMessageId: v.id('messages'),
    modelId: v.string(),
    webSearch: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { chatId, fromMessageId, modelId, webSearch },
  ): Promise<{
    success: boolean
    assistantMessageId: Id<'messages'>
  }> => {
    await requireUserId(ctx)
    // Throws unless the caller owns the chat
    await ctx.runQuery(api.chat.queries.getChat, { chatId })

    let assistantMessageId: Id<'messages'> | undefined
    try {
      await ctx.runMutation(api.chat.mutations.deleteMessagesFromIndex, {
        chatId,
        fromMessageId,
      })

      const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId })
      const chatMessages = toModelMessages(messages)

      assistantMessageId = await ctx.runMutation(internal.chat.mutations.insertMessage, {
        chatId,
        role: 'assistant',
        content: '',
        modelId,
        isComplete: false,
      })

      await generateAIResponse(ctx, chatMessages, modelId, assistantMessageId, webSearch)

      return {
        success: true,
        assistantMessageId,
      }
    } catch (error) {
      console.error('Error in retryMessage action:', error)
      await recordFailure(
        ctx,
        chatId,
        assistantMessageId,
        'I apologize, but I encountered an error while retrying the message. Please try again.',
        modelId,
      )
      throw error
    }
  },
})

export const editMessageAndRegenerate = action({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
    modelId: v.string(),
    webSearch: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { messageId, content, modelId, webSearch },
  ): Promise<{
    success: boolean
    assistantMessageId: Id<'messages'>
  }> => {
    await requireUserId(ctx)
    assertMaxLength(content, MAX_MESSAGE_CHARS, 'Message')

    // Both throw unless the caller owns the message's chat
    const message = await ctx.runQuery(api.chat.queries.getMessage, { messageId })
    if (!message) {
      throw new Error('Message not found')
    }
    await ctx.runQuery(api.chat.queries.getChat, { chatId: message.chatId })

    if (message.role !== 'user') {
      throw new Error('Only user messages can be edited')
    }

    let assistantMessageId: Id<'messages'> | undefined
    try {
      await ctx.runMutation(internal.chat.mutations.setUserMessageContent, {
        messageId,
        content,
      })

      const allMessages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId: message.chatId })

      const editedMessageIndex = allMessages.findIndex((msg) => msg._id === messageId)
      if (editedMessageIndex === -1) {
        throw new Error('Message not found in chat')
      }

      // Delete the reply to the edited message and everything after it
      const nextAssistantMessage = allMessages.slice(editedMessageIndex + 1).find((msg) => msg.role === 'assistant')
      if (nextAssistantMessage) {
        await ctx.runMutation(api.chat.mutations.deleteMessagesFromIndex, {
          chatId: message.chatId,
          fromMessageId: nextAssistantMessage._id,
        })
      }

      const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId: message.chatId })
      const chatMessages = toModelMessages(messages)

      assistantMessageId = await ctx.runMutation(internal.chat.mutations.insertMessage, {
        chatId: message.chatId,
        role: 'assistant',
        content: '',
        modelId,
        isComplete: false,
      })

      await generateAIResponse(ctx, chatMessages, modelId, assistantMessageId, webSearch)

      return {
        success: true,
        assistantMessageId,
      }
    } catch (error) {
      console.error('Error in editMessageAndRegenerate action:', error)
      await recordFailure(
        ctx,
        message.chatId,
        assistantMessageId,
        'I apologize, but I encountered an error while processing your edited message. Please try again.',
        modelId,
      )
      throw error
    }
  },
})

// ACTIONS - for external API calls
export const sendMessage = action({
  args: {
    chatId: v.id('chats'),
    message: v.string(),
    modelId: v.string(),
    attachments: v.optional(v.array(attachmentValidator)),
    webSearch: v.optional(v.boolean()),
    imageGen: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { chatId, message, modelId, attachments, webSearch, imageGen },
  ): Promise<{
    success: boolean
    userMessageId: Id<'messages'>
    assistantMessageId: Id<'messages'>
  }> => {
    await requireUserId(ctx)
    assertMaxLength(message, MAX_MESSAGE_CHARS, 'Message')
    // Only files uploaded through this app; the server downloads these URLs
    assertValidAttachments(attachments)

    // Throws unless the caller owns the chat
    await ctx.runQuery(api.chat.queries.getChat, { chatId })

    // History before the new message
    const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId })

    const userMessageId: Id<'messages'> = await ctx.runMutation(internal.chat.mutations.insertMessage, {
      chatId,
      role: 'user',
      content: message,
      attachments,
    })

    const chatMessages = toModelMessages(messages)

    let assistantMessageId: Id<'messages'> | undefined
    try {
      assistantMessageId = await ctx.runMutation(internal.chat.mutations.insertMessage, {
        chatId,
        role: 'assistant',
        content: '',
        modelId,
        isComplete: false,
      })

      if ((attachments && attachments.length > 0) || imageGen) {
        return await ctx.runAction(internal.chat.node.sendMessage, {
          chatMessages,
          modelId,
          attachments: attachments ?? [],
          message,
          assistantMessageId,
          webSearch,
          userMessageId,
          imageGen,
        })
      }

      chatMessages.push({
        role: 'user' as const,
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      })

      await generateAIResponse(ctx, chatMessages, modelId, assistantMessageId, webSearch)

      return {
        success: true,
        userMessageId,
        assistantMessageId,
      }
    } catch (error) {
      await recordFailure(
        ctx,
        chatId,
        assistantMessageId,
        'I apologize, but I encountered an error while processing your message. Please try again.',
        modelId,
      )
      throw error
    }
  },
})

const MAX_TITLE_PROMPT_CHARS = 2_000

/**
 * Generates a chat title from the first user message. Internal: scheduled by
 * the message insert, which has already checked ownership. Scheduled functions
 * run without a session, so the title is stored through an internal mutation.
 */
export const generateTitle = internalAction({
  args: {
    chatId: v.id('chats'),
    messageContent: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, { chatId, messageContent }) => {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
    const aiModel = google(TITLE_MODEL_ID)

    const titlePrompt = `Based on the following user message, generate a short, concise title for the chat (4-5 words max) No Markdown Allowed:\n\nUser: "${messageContent.slice(0, MAX_TITLE_PROMPT_CHARS)}"\n\nTitle:`

    let text: string
    try {
      ;({ text } = await generateText({
        model: aiModel,
        prompt: titlePrompt,
      }))
    } catch (error) {
      // Log controlled fields only: the provider's error text can echo request details
      console.error(
        'Title generation error:',
        describeProviderError({ provider: 'gemini', model: TITLE_MODEL_ID }, error),
      )
      // Don't leave the chat marked as generating a title
      await ctx.runMutation(internal.chat.mutations.setGeneratedTitle, { chatId })
      return
    }

    const title = text.replace(/["\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

    await ctx.runMutation(internal.chat.mutations.setGeneratedTitle, {
      chatId,
      title: title || undefined,
    })
  },
})
