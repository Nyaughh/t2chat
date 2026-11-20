import { streamText, type LanguageModel, type ModelMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { models, DEFAULT_MODEL_ID, getProviderDisplayName, type ModelInfo } from '@/lib/models'
import { basePersonality } from '../../../../prompts/base'

export const maxDuration = 30

// This route has no access to a user's own keys, so it only serves models that
// run on the server's Gemini, Groq and OpenRouter keys. Anthropic and OpenAI
// models go through the signed-in Convex chat flow instead.
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

interface UserSettings {
  userName?: string
  userRole?: string
  userTraits?: string[]
  userAdditionalInfo?: string
  promptTemplate?: string
}

const buildPersonalizedSystemPrompt = (userSettings?: UserSettings): string => {
  if (!userSettings) return basePersonality

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
    return `${userSettings.promptTemplate}\n\n${personalization}`
  } else {
    return `${basePersonality}\n\n${personalization}`
  }
}

const defaultModel = models.find((m) => m.id === DEFAULT_MODEL_ID)!

const mapModel = (
  modelId: string,
): { info: ModelInfo; model: LanguageModel; thinking: boolean } | { error: string } => {
  const info = models.find((m) => m.id === modelId) ?? defaultModel

  switch (info.provider) {
    case 'gemini':
      return { info, model: google(info.id), thinking: !!info.supportsThinking }
    case 'groq':
      return { info, model: groq(info.id), thinking: !!info.supportsThinking }
    case 'openrouter':
      return { info, model: openrouter(info.id), thinking: false }
    default:
      return {
        error: `${info.name} needs your own ${getProviderDisplayName(info.provider)} API key and isn't available here. Choose a Gemini, Groq or OpenRouter model instead.`,
      }
  }
}

// Same line format as the AI SDK v4 data stream ("2:" data parts), which
// src/lib/stream-parser.ts reads on the client.
const encoder = new TextEncoder()
const dataLine = (type: 'text' | 'reasoning' | 'finish' | 'error', value: unknown) =>
  encoder.encode(`2:${JSON.stringify([{ type, value }])}\n`)

const streamHeaders = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
}

export async function POST(req: Request) {
  try {
    const { messages, data } = (await req.json()) as {
      messages: ModelMessage[]
      data: { modelId: string; userSettings?: UserSettings }
    }
    const { modelId, userSettings } = data

    const mapped = mapModel(modelId)
    if ('error' in mapped) {
      return new Response(dataLine('error', mapped.error), { status: 200, headers: streamHeaders })
    }
    const { info, model, thinking } = mapped

    const { stream } = streamText({
      instructions: buildPersonalizedSystemPrompt(userSettings),
      model,
      messages,
      providerOptions:
        thinking && info.provider === 'gemini'
          ? { google: { thinkingConfig: { includeThoughts: true } } }
          : thinking && info.provider === 'groq' && !info.id.startsWith('openai/gpt-oss')
            ? { groq: { reasoningFormat: 'parsed' } }
            : undefined,
      abortSignal: req.signal,
      // Errors are forwarded to the client in the stream loop below
      onError: () => {},
    })

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let thinkingStartTime: number | null = null
        let thinkingEndTime: number | null = null

        try {
          for await (const chunk of stream) {
            if (chunk.type === 'text-delta') {
              if (thinkingStartTime && !thinkingEndTime) thinkingEndTime = Date.now()
              controller.enqueue(dataLine('text', chunk.text))
            } else if (chunk.type === 'reasoning-delta') {
              if (!chunk.text) continue
              if (!thinkingStartTime) thinkingStartTime = Date.now()
              controller.enqueue(dataLine('reasoning', chunk.text))
            } else if (chunk.type === 'finish') {
              if (thinkingStartTime && !thinkingEndTime) thinkingEndTime = Date.now()

              const thinkingDuration =
                thinkingStartTime && thinkingEndTime
                  ? Math.round((thinkingEndTime - thinkingStartTime) / 1000)
                  : undefined

              controller.enqueue(
                dataLine('finish', {
                  finishReason: chunk.finishReason || 'unknown',
                  usage: chunk.totalUsage || {},
                  ...(thinkingDuration && { thinkingDuration }),
                }),
              )
            } else if (chunk.type === 'error') {
              controller.enqueue(
                dataLine('error', (chunk.error as { message?: string } | undefined)?.message || 'Unknown error'),
              )
            }
          }
        } catch (error) {
          if (!req.signal.aborted) {
            controller.enqueue(dataLine('error', error instanceof Error ? error.message : 'Unknown error'))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(body, { status: 200, headers: streamHeaders })
  } catch (error) {
    console.error('Error in chat API:', error instanceof Error ? error.message : error)
    if (error instanceof Error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 })
  }
}
