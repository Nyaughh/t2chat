import { api } from '../_generated/api'
import { Id } from '../_generated/dataModel'
import { ConvexError } from 'convex/values'
import { models, ModelInfo, IMAGE_GENERATION_MODEL_ID, getProviderDisplayName } from '../../src/lib/models'
import { streamText, tool, ModelMessage, smoothStream, isStepCount, type LanguageModel, type ToolSet } from 'ai'
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from '@ai-sdk/google'
import { createAnthropic, type AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { Modality } from '@google/genai'
import { basePersonality } from '../../prompts/base'
import { Buffer } from 'buffer'
import { getUserApiKey } from '../api_keys'

export const mapModel = (modelId: string) => {
  const model = models.find((m) => m.id === modelId)

  if (!model) {
    return {
      model: null,
      thinking: false,
      provider: 'gemini' as const,
    }
  }

  return {
    model: model,
    thinking: model.supportsThinking || false,
    provider: model.provider,
  }
}

/**
 * Creates the language model for a catalog entry. Gemini, Groq and OpenRouter
 * fall back to the server keys; Anthropic and OpenAI need the user's own key.
 */
const createLanguageModel = async (ctx: any, model: ModelInfo): Promise<LanguageModel> => {
  const requireUserKey = (key: string | null) => {
    if (!key) {
      throw new ConvexError(
        `${model.name} needs your own ${getProviderDisplayName(model.provider)} API key. Add one in Settings → Models & Keys.`,
      )
    }
    return key
  }

  switch (model.provider) {
    case 'gemini': {
      const apiKey = (await getUserApiKey(ctx, 'gemini')) ?? process.env.GEMINI_API_KEY
      return createGoogleGenerativeAI({ apiKey })(model.id)
    }
    case 'groq': {
      const apiKey = (await getUserApiKey(ctx, 'groq')) ?? process.env.GROQ_API_KEY
      return createGroq({ apiKey })(model.id)
    }
    case 'openrouter': {
      const apiKey = (await getUserApiKey(ctx, 'openrouter')) ?? process.env.OPENROUTER_API_KEY
      return createOpenRouter({ apiKey })(model.id, { extraBody: { transforms: ['middle-out'] } })
    }
    case 'anthropic': {
      const apiKey = requireUserKey(await getUserApiKey(ctx, 'anthropic'))
      return createAnthropic({ apiKey })(model.id)
    }
    case 'openai': {
      const apiKey = requireUserKey(await getUserApiKey(ctx, 'openai'))
      return createOpenAI({ apiKey })(model.id)
    }
  }
}

/** Provider options that make reasoning visible for "thinking" models. */
type ProviderOptions = Parameters<typeof streamText>[0]['providerOptions']

const reasoningProviderOptions = (model: ModelInfo, thinking: boolean): ProviderOptions => {
  switch (model.provider) {
    case 'gemini':
      return thinking
        ? { google: { thinkingConfig: { includeThoughts: true } } satisfies GoogleLanguageModelOptions }
        : undefined
    case 'anthropic':
      return thinking
        ? {
            anthropic: {
              thinking: { type: 'adaptive', display: 'summarized' },
            } satisfies AnthropicLanguageModelOptions,
          }
        : undefined
    case 'openai':
      return thinking ? { openai: { reasoningSummary: 'auto' } } : undefined
    case 'groq':
      // gpt-oss returns reasoning separately by default; other Groq reasoning models need "parsed"
      return thinking && !model.id.startsWith('openai/gpt-oss') ? { groq: { reasoningFormat: 'parsed' } } : undefined
    case 'openrouter':
      return thinking ? { openrouter: { reasoning: { effort: 'medium' } } } : undefined
  }
}

// Helper function to generate AI response
export const generateAIResponse = async (
  ctx: any,
  chatMessages: ModelMessage[],
  modelId: string,
  assistantMessageId: Id<'messages'>,
  webSearch?: boolean,
  isNode = false,
) => {
  const { model, thinking, provider } = mapModel(modelId)

  if (!model) {
    throw new Error('Invalid model selected')
  }

  let aiModel: LanguageModel
  try {
    aiModel = await createLanguageModel(ctx, model)
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error
    // Missing or unreadable user key: explain it in the chat instead of failing silently
    await ctx.runMutation(api.chat.mutations.updateMessage, {
      messageId: assistantMessageId,
      content: `*${error.data}*`,
      isComplete: true,
    })
    return
  }

  // Fetch user settings
  const userSettings = await ctx.runQuery(api.users.getMySettings)
  let personalizedSystemPrompt = basePersonality

  if (userSettings) {
    let personalization = '### User Personalization\n'
    if (userSettings.userName) personalization += `The user's name is ${userSettings.userName}.\n`
    if (userSettings.userRole) personalization += `The user is a ${userSettings.userRole}.\n`
    if (userSettings.userTraits && userSettings.userTraits.length > 0) {
      personalization += `The user has the following traits/interests: ${userSettings.userTraits.join(', ')}.\n`
    }
    if (userSettings.userAdditionalInfo) {
      personalization += `Here is some additional information about the user: ${userSettings.userAdditionalInfo}\n`
    }

    if (userSettings.promptTemplate) {
      personalizedSystemPrompt = `${userSettings.promptTemplate}\n\n${personalization}`
    } else {
      personalizedSystemPrompt = `${basePersonality}\n\n${personalization}`
    }
  }

  // Prepare tools
  const tools: ToolSet = {}

  if (webSearch) {
    tools.search = tool({
      description:
        "Search the web for current information. Use this when you need up-to-date information that might not be in your training data. IMPORTANT: Always explain what you're searching for and why before calling this tool.",
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant information'),
      }),
      execute: async ({ query }) => {
        try {
          // Use Tavily API for web search
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
              query,
              search_depth: 'basic',
              include_answer: true,
              include_raw_content: false,
              max_results: 5,
            }),
          })

          if (!response.ok) {
            throw new Error(`Search API error: ${response.status}`)
          }

          const data = await response.json()

          return {
            query,
            answer: data.answer || '',
            results: data.results || [],
            timestamp: new Date().toISOString(),
          }
        } catch (error) {
          console.error('Web search error:', error)
          return {
            query,
            error: 'Failed to perform web search',
            results: [],
            timestamp: new Date().toISOString(),
          }
        }
      },
    })
  }

  //Add image generation tool
  if (model.features.includes('imagegen')) {
    tools.generateImage = tool({
      description:
        "Generate an image based on a text description. Use this when the user asks you to create, generate, or make an image. IMPORTANT: Always explain what you're going to generate and why before calling this tool.",
      inputSchema: z.object({
        prompt: z.string().describe('The detailed description of the image to generate'),
      }),
      execute: async ({ prompt }) => {
        try {
          // Use the user's Gemini key if they added one, otherwise the system key
          const userGeminiKey = await getUserApiKey(ctx, 'gemini')
          const apiKey = userGeminiKey ?? process.env.GEMINI_API_KEY

          // Use Google Gen AI SDK for image generation
          const { GoogleGenAI } = await import('@google/genai')
          const genAI = new GoogleGenAI({ apiKey })

          const result = await genAI.models.generateContent({
            model: IMAGE_GENERATION_MODEL_ID,
            contents: prompt,
            config: {
              responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
          })

          const parts = result.candidates?.[0]?.content?.parts || []
          let imageData: string | null = null
          let imageMimeType = 'image/png'
          let description = ''

          for (const part of parts) {
            if (part.thought) continue
            if (part.text) {
              description += part.text
            } else if (part.inlineData?.data) {
              imageData = part.inlineData.data
              imageMimeType = part.inlineData.mimeType || imageMimeType
            }
          }

          if (imageData) {
            // Convert base64 to buffer and store in Convex
            const imageBuffer = Buffer.from(imageData, 'base64')

            // Store the image in Convex file storage
            const storageId = await ctx.storage.store(new Blob([imageBuffer], { type: imageMimeType }))

            // Get the public URL for the stored image
            const imageUrl = await ctx.storage.getUrl(storageId)

            return {
              success: true,
              prompt: prompt,
              description: description,
              imageUrl: imageUrl,
              storageId: storageId,
              timestamp: new Date().toISOString(),
              usedUserKey: !!userGeminiKey,
            }
          } else {
            return {
              success: false,
              error: 'No image was generated',
              prompt: prompt,
              timestamp: new Date().toISOString(),
            }
          }
        } catch (error: any) {
          console.error('Image generation error:', error?.message || error)
          return {
            success: false,
            error: `Failed to generate image: ${error?.message || error}`,
            prompt: prompt,
            timestamp: new Date().toISOString(),
          }
        }
      },
    })
  }

  const hasTools = Object.keys(tools).length > 0
  // Newer Anthropic and OpenAI reasoning models reject custom sampling settings
  const supportsTemperature = provider !== 'anthropic' && provider !== 'openai'

  // Stream the response
  const { stream } = streamText({
    instructions: personalizedSystemPrompt,
    model: aiModel,
    messages: chatMessages,
    stopWhen: isStepCount(20),
    tools: hasTools ? tools : undefined,
    toolChoice: hasTools ? 'auto' : undefined,
    temperature: supportsTemperature ? 0.7 : undefined,
    maxOutputTokens: provider === 'openrouter' ? 4000 : undefined,
    providerOptions: reasoningProviderOptions(model, thinking),
    experimental_transform: smoothStream({
      chunking: isNode ? 'line' : 'word',
    }),
    // Errors are handled (and logged without request details) in the stream loop below
    onError: () => {},
  })

  let isFinalized = false
  let accumulatedContent = ''
  let accumulatedThinking = ''
  let thinkingStartTime: number | null = null
  let thinkingEndTime: number | null = null
  let accumulatedToolCalls: any[] = []
  let hasGeneratedTextBeforeTools = false

  // Batching mechanism for performance optimization
  let lastUpdateTime = Date.now()
  let pendingContentUpdate = false
  let pendingThinkingUpdate = false
  const UPDATE_INTERVAL = 150 // Update every 150ms max

  // Debounced update function
  const scheduleUpdate = async (force = false) => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateTime

    if (!force && timeSinceLastUpdate < UPDATE_INTERVAL) {
      // Schedule an update if one isn't already pending
      if (!pendingContentUpdate && !pendingThinkingUpdate) {
        setTimeout(() => scheduleUpdate(true), UPDATE_INTERVAL - timeSinceLastUpdate)
      }
      return
    }

    try {
      if (pendingContentUpdate || pendingThinkingUpdate) {
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent,
          thinking: accumulatedThinking || undefined,
          isComplete: false,
        })
        lastUpdateTime = now
        pendingContentUpdate = false
        pendingThinkingUpdate = false
      }
    } catch (updateError) {
      console.warn('Failed to update message during batched update:', updateError)
    }
  }

  for await (const chunk of stream) {
    try {
      // Only content-bearing parts need a cancellation check
      if (
        chunk.type !== 'text-delta' &&
        chunk.type !== 'reasoning-delta' &&
        chunk.type !== 'tool-call' &&
        chunk.type !== 'tool-result' &&
        chunk.type !== 'tool-error' &&
        chunk.type !== 'finish' &&
        chunk.type !== 'error'
      ) {
        continue
      }

      // Check if the message has been cancelled
      const message = await ctx.runQuery(api.chat.queries.getMessage, { messageId: assistantMessageId })
      if (message?.isCancelled) {
        break
      }

      if (chunk.type === 'text-delta') {
        // Reasoning ends when the first answer text arrives
        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now()
        }
        accumulatedContent += chunk.text
        hasGeneratedTextBeforeTools = true
        pendingContentUpdate = true

        // Schedule batched update
        await scheduleUpdate()
      } else if (chunk.type === 'reasoning-delta') {
        if (!chunk.text) continue

        // Track thinking start time
        if (!thinkingStartTime) {
          thinkingStartTime = Date.now()
        }

        accumulatedThinking += chunk.text
        pendingThinkingUpdate = true

        // Schedule batched update for thinking
        await scheduleUpdate()
      } else if (chunk.type === 'tool-call') {
        // If no text was generated before this tool call, add some explanatory text
        if (!hasGeneratedTextBeforeTools && accumulatedContent.trim() === '') {
          let explanatoryText = ''
          if (chunk.toolName === 'generateImage') {
            explanatoryText = `I'll generate an image for you based on your request. `
          } else if (chunk.toolName === 'search') {
            explanatoryText = `Let me search for current information about that. `
          } else {
            explanatoryText = `I'll use a tool to help with your request. `
          }
          accumulatedContent += explanatoryText
        }

        const placeholder = `\n[TOOL_CALL:${chunk.toolCallId}]\n`
        accumulatedContent += placeholder
        accumulatedToolCalls.push({
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.input,
        })
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent,
          toolCalls: accumulatedToolCalls,
        })
      } else if (chunk.type === 'tool-result' || chunk.type === 'tool-error') {
        const toolCall = accumulatedToolCalls.find((tc) => tc.toolCallId === chunk.toolCallId)
        if (toolCall) {
          toolCall.result =
            chunk.type === 'tool-result'
              ? chunk.output
              : { success: false, error: 'The tool failed to run', results: [] }
        }
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          toolCalls: accumulatedToolCalls,
        })
      } else if (chunk.type === 'finish') {
        // Track thinking end time
        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now()
        }

        // Calculate thinking duration in seconds
        const duration =
          thinkingStartTime && thinkingEndTime ? Math.round((thinkingEndTime - thinkingStartTime) / 1000) : undefined

        // Force final update to ensure all content is saved
        await scheduleUpdate(true)

        // Mark the message as complete with final thinking data
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent,
          thinking: accumulatedThinking || undefined,
          thinkingDuration: duration,
          isComplete: true,
          toolCalls: accumulatedToolCalls,
        })
        isFinalized = true
        break
      } else if (chunk.type === 'error') {
        console.error(`Model stream error (${provider}/${model.id}):`, describeStreamError(chunk.error))

        // Force final update before handling error
        await scheduleUpdate(true)

        // Handle error
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: `${accumulatedContent ? `${accumulatedContent}\n\n` : ''}*${userFacingStreamError(chunk.error, model)}*`,
          thinking: accumulatedThinking || undefined,
          isComplete: true,
          toolCalls: accumulatedToolCalls,
        })
        isFinalized = true
        break
      }
    } catch (updateError) {
      // If we can't update the message (e.g., due to conflicts), continue streaming
      // but don't fail the entire operation
      console.warn('Failed to update message during streaming:', updateError)
    }
  }

  // Ensure the message is marked as complete if the loop exits without finishing (e.g. cancelled)
  if (isFinalized) return
  try {
    // Force final update to ensure all content is saved
    await scheduleUpdate(true)

    await ctx.runMutation(api.chat.mutations.updateMessage, {
      messageId: assistantMessageId,
      content: accumulatedContent || 'Generation was interrupted.',
      thinking: accumulatedThinking || undefined,
      isComplete: true,
      toolCalls: accumulatedToolCalls,
    })
  } catch (finalUpdateError) {
    console.warn('Failed to mark message as complete:', finalUpdateError)
  }
}

/** HTTP status of a provider error, looking through the SDK's retry wrapper. */
const statusCodeOf = (error: unknown): number | undefined => {
  const err = error as { statusCode?: number; lastError?: { statusCode?: number } } | undefined
  return err?.statusCode ?? err?.lastError?.statusCode
}

/** Status code and a short message only: never log request details. */
const describeStreamError = (error: unknown) => ({
  statusCode: statusCodeOf(error),
  message: (error as { message?: string } | undefined)?.message?.slice(0, 300),
})

const userFacingStreamError = (error: unknown, model: ModelInfo) => {
  const statusCode = statusCodeOf(error)
  const provider = getProviderDisplayName(model.provider)
  if (statusCode === 401 || statusCode === 403) {
    return `${provider} rejected the API key. Check your key in Settings → Models & Keys.`
  }
  if (statusCode === 429) {
    return `${provider} rate limit or quota reached. Please try again later.`
  }
  if (statusCode === 500 || statusCode === 503 || statusCode === 529) {
    return `${model.name} is temporarily overloaded. Please try again in a moment or pick another model.`
  }
  return 'Error occurred while generating response.'
}
