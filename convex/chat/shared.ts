import { api, internal } from '../_generated/api'
import { Id } from '../_generated/dataModel'
import { ConvexError } from 'convex/values'
import {
  models,
  ModelInfo,
  IMAGE_GENERATION_MODEL_ID,
  getProviderDisplayName,
  groqReasoningOptions,
} from '../../src/lib/models'
import { streamText, tool, ModelMessage, isStepCount, type LanguageModel, type ToolSet } from 'ai'
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
import { describeProviderError, providerErrorStatus, userFacingProviderError } from '../../src/lib/provider-errors'

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
    case 'groq': {
      const groq = thinking ? groqReasoningOptions(model) : undefined
      return groq ? { groq } : undefined
    }
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
    await ctx.runMutation(internal.chat.mutations.updateMessage, {
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
      execute: async ({ query }, { abortSignal }) => {
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
            signal: abortSignal,
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
          console.error('Web search error:', describeProviderError({ provider: 'tavily', model: 'search' }, error))
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
      execute: async ({ prompt }, { abortSignal }) => {
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
              abortSignal,
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
        } catch (error) {
          // The Gemini error text can echo request details: log and return fixed fields only
          console.error(
            'Image generation error:',
            describeProviderError({ provider: 'gemini', model: IMAGE_GENERATION_MODEL_ID }, error),
          )
          return {
            success: false,
            error: providerErrorStatus(error)
              ? `Failed to generate image (status ${providerErrorStatus(error)})`
              : 'Failed to generate image',
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

  // Stream the response. Progress reaches clients through small append-only
  // writes (chat/streaming.ts), so there's no server-side smoothing (it only
  // delayed the action and multiplied chunk handling).
  const abortController = new AbortController()
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
    // Aborted when the user stops the reply (or it is closed): ends the provider request and any running tool
    abortSignal: abortController.signal,
    // Errors are handled (and logged without request details) in the stream loop below
    onError: () => {},
  })

  let accumulatedContent = ''
  let accumulatedThinking = ''
  let thinkingStartTime: number | null = null
  let thinkingEndTime: number | null = null
  const accumulatedToolCalls: any[] = []
  let hasGeneratedTextBeforeTools = false

  // ---------------------------------------------------------------------------
  // Progress writes and stop detection
  //
  // - Text goes out at most once per FLUSH_INTERVAL_MS, plus a trailing write so
  //   text that arrives just before a pause still shows. Each write carries only
  //   the text added since the stored length (offset-checked, so a retry is
  //   idempotent). Writes run one at a time, in order.
  // - Every write reports whether to stop. While the stream is quiet (before
  //   the first text, during a provider or tool stall) a heartbeat asks every
  //   STOP_POLL_MS instead, so a stopped reply never waits for more output.
  // - Stopping aborts the provider request and any running tool.
  // ---------------------------------------------------------------------------
  const FLUSH_INTERVAL_MS = 150
  const STOP_POLL_MS = 1_000
  let lastFlushAt = 0
  let lastStopCheckAt = Date.now()
  let dirty = false
  let finalizing = false
  let stopRequested = false
  let storedContentLength = 0
  let storedThinkingLength = 0
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let flushChain: Promise<void> = Promise.resolve()

  const requestStop = () => {
    if (stopRequested) return
    stopRequested = true
    abortController.abort()
  }

  const clearFlushTimer = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }

  const flushNow = () => {
    clearFlushTimer()
    if (!dirty || finalizing || stopRequested) return flushChain
    dirty = false
    lastFlushAt = Date.now()
    flushChain = flushChain.then(async () => {
      if (finalizing || stopRequested) return
      try {
        const result = await ctx.runMutation(internal.chat.streaming.writeStreamProgress, {
          messageId: assistantMessageId,
          contentOffset: storedContentLength,
          contentDelta: accumulatedContent.slice(storedContentLength),
          thinkingOffset: storedThinkingLength,
          thinkingDelta: accumulatedThinking.slice(storedThinkingLength),
        })
        storedContentLength = result.contentLength
        storedThinkingLength = result.thinkingLength
        lastStopCheckAt = Date.now()
        if (result.stop) requestStop()
      } catch (writeError) {
        // Nothing was stored; the next write resends from the stored length
        dirty = true
        console.warn('Failed to write streaming progress:', writeError)
      }
    })
    return flushChain
  }

  const markDirty = () => {
    dirty = true
    const wait = FLUSH_INTERVAL_MS - (Date.now() - lastFlushAt)
    if (wait <= 0) {
      void flushNow()
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => void flushNow(), wait)
    }
  }

  const heartbeat = setInterval(() => {
    if (finalizing || stopRequested || Date.now() - lastStopCheckAt < STOP_POLL_MS) return
    lastStopCheckAt = Date.now()
    ctx
      .runQuery(internal.chat.streaming.getStreamStatus, { messageId: assistantMessageId })
      .then((status: { stop: boolean }) => {
        if (status.stop) requestStop()
      })
      .catch((statusError: unknown) => console.warn('Failed to check whether the reply was stopped:', statusError))
  }, STOP_POLL_MS / 4)

  /** Stops progress writes and waits for any in flight, so the final write lands last. */
  const stopProgressWrites = async () => {
    finalizing = true
    clearInterval(heartbeat)
    clearFlushTimer()
    await flushChain
  }

  const thinkingDurationSeconds = () => {
    if (thinkingStartTime && !thinkingEndTime) thinkingEndTime = Date.now()
    return thinkingStartTime && thinkingEndTime ? Math.round((thinkingEndTime - thinkingStartTime) / 1000) : undefined
  }

  // Appends a fixed, user-facing error note (never the provider's own error text)
  const withErrorNote = (error: unknown) => {
    const note = userFacingProviderError(error, getProviderDisplayName(model.provider), model.name)
    return accumulatedContent ? `${accumulatedContent}\n\n*${note}*` : `*${note}*`
  }

  /**
   * The single terminal write. finalizeStream decides authoritatively: a stopped
   * reply keeps its stop note, and a reply closed some other way isn't reopened.
   */
  const finalize = async (fields: { content: string; thinkingDuration?: number }) => {
    await stopProgressWrites()
    try {
      await ctx.runMutation(internal.chat.streaming.finalizeStream, {
        messageId: assistantMessageId,
        content: fields.content,
        thinking: accumulatedThinking || undefined,
        thinkingDuration: fields.thinkingDuration,
        toolCalls: accumulatedToolCalls,
      })
    } catch (finalUpdateError) {
      console.warn('Failed to mark message as complete:', finalUpdateError)
    }
  }

  let outcome: { kind: 'finished' } | { kind: 'error'; error: unknown } | { kind: 'ended' } = { kind: 'ended' }

  try {
    for await (const chunk of stream) {
      if (stopRequested) break

      if (chunk.type === 'text-delta') {
        // Reasoning ends when the first answer text arrives
        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now()
        }
        accumulatedContent += chunk.text
        hasGeneratedTextBeforeTools = true
        markDirty()
      } else if (chunk.type === 'reasoning-delta') {
        if (!chunk.text) continue
        if (!thinkingStartTime) {
          thinkingStartTime = Date.now()
        }
        accumulatedThinking += chunk.text
        markDirty()
      } else if (chunk.type === 'tool-call') {
        // If no text was generated before this tool call, add some explanatory text
        if (!hasGeneratedTextBeforeTools && accumulatedContent.trim() === '') {
          if (chunk.toolName === 'generateImage') {
            accumulatedContent += `I'll generate an image for you based on your request. `
          } else if (chunk.toolName === 'search') {
            accumulatedContent += `Let me search for current information about that. `
          } else {
            accumulatedContent += `I'll use a tool to help with your request. `
          }
        }

        accumulatedContent += `\n[TOOL_CALL:${chunk.toolCallId}]\n`
        accumulatedToolCalls.push({
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.input,
        })
        // Tool calls are rare: record them on the message now, and show the marker right away
        try {
          await ctx.runMutation(internal.chat.mutations.updateMessage, {
            messageId: assistantMessageId,
            toolCalls: accumulatedToolCalls,
          })
        } catch (updateError) {
          console.warn('Failed to record tool call:', updateError)
        }
        dirty = true
        await flushNow()
      } else if (chunk.type === 'tool-result' || chunk.type === 'tool-error') {
        const toolCall = accumulatedToolCalls.find((tc) => tc.toolCallId === chunk.toolCallId)
        if (toolCall) {
          toolCall.result =
            chunk.type === 'tool-result'
              ? chunk.output
              : { success: false, error: 'The tool failed to run', results: [] }
        }
        try {
          await ctx.runMutation(internal.chat.mutations.updateMessage, {
            messageId: assistantMessageId,
            toolCalls: accumulatedToolCalls,
          })
        } catch (updateError) {
          console.warn('Failed to record tool result:', updateError)
        }
      } else if (chunk.type === 'finish') {
        outcome = { kind: 'finished' }
        break
      } else if (chunk.type === 'error') {
        outcome = { kind: 'error', error: chunk.error }
        break
      }
    }
  } catch (streamError) {
    // Errors thrown by the stream itself (rather than sent as error parts).
    // Stopping the reply aborts the request, which surfaces here too.
    if (!stopRequested) outcome = { kind: 'error', error: streamError }
  }

  if (stopRequested) {
    // Stopped or closed while streaming: finalizeStream adds the stop note (or leaves a closed reply alone)
    await finalize({ content: accumulatedContent, thinkingDuration: thinkingDurationSeconds() })
  } else if (outcome.kind === 'finished') {
    await finalize({ content: accumulatedContent, thinkingDuration: thinkingDurationSeconds() })
  } else if (outcome.kind === 'error') {
    // Log controlled fields only: the provider's error text can echo request details
    console.error('Model stream error:', describeProviderError({ provider, model: model.id }, outcome.error))
    await finalize({ content: withErrorNote(outcome.error) })
  } else {
    // The stream ended without a finish event
    await finalize({ content: accumulatedContent || 'Generation was interrupted.' })
  }
}
