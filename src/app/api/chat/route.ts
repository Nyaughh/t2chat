import { streamText, type LanguageModel, type ModelMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'

import {
  models,
  DEFAULT_MODEL_ID,
  getProviderDisplayName,
  groqReasoningOptions,
  openaiReasoningEffort,
  type ModelInfo,
} from '@/lib/models'
import { describeProviderError, providerErrorStatus, userFacingProviderError } from '@/lib/provider-errors'
import { serverKeyEnvVar } from '@/lib/serverQuota'
import { clientIp, consumeServerQuota, hasServerKey, reportProviderLimit } from '@/lib/server-quota-client'
import { getToken } from '@/lib/auth-server'
import { basePersonality } from '../../../../prompts/base'

export const maxDuration = 30

// This route has no access to a user's own keys, so it only serves the free models that run on the
// server's keys (GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY), within the usage limits in Convex.
// Every other model goes through the signed-in Convex chat flow with the user's own key.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

  if (!serverKeyEnvVar(info)) {
    return {
      error: `${info.name} needs your own ${getProviderDisplayName(info.provider)} API key. Sign in and add one in Settings → Models & Keys, or pick a free model.`,
    }
  }
  if (!hasServerKey(info.id)) return { error: `${info.name} isn't available right now. Please pick another model.` }

  switch (info.provider) {
    case 'gemini':
      return { info, model: google(info.id), thinking: !!info.supportsThinking }
    case 'groq':
      return { info, model: groq(info.id), thinking: !!info.supportsThinking }
    case 'openai':
      return { info, model: openai(info.id), thinking: false }
    default:
      return { error: `${info.name} isn't available here. Please pick another model.` }
  }
}

type ProviderOptions = Parameters<typeof streamText>[0]['providerOptions']

const providerOptionsFor = (info: ModelInfo, thinking: boolean): ProviderOptions => {
  const reasoningEffort = info.provider === 'openai' ? openaiReasoningEffort(info) : undefined
  if (reasoningEffort) return { openai: { reasoningEffort } }
  if (thinking && info.provider === 'gemini') return { google: { thinkingConfig: { includeThoughts: true } } }
  const groqOptions = thinking ? groqReasoningOptions(info) : undefined
  return groqOptions ? { groq: groqOptions } : undefined
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

    // Usage limits (Convex): signed-in callers by account, guests by IP
    const quota = await consumeServerQuota(info.id, { token: await getToken().catch(() => undefined), ip: clientIp(req.headers) })
    if (!quota.available) {
      const message =
        quota.reason === 'cooldown'
          ? `${info.name} is busy right now. Try again in a few minutes or pick another model.`
          : quota.reason === 'no-key'
            ? `${info.name} isn't available right now. Please pick another model.`
            : `You've reached today's free limit for ${info.name}. Pick another model, or sign in and add your own ${getProviderDisplayName(info.provider)} API key.`
      return new Response(dataLine('error', message), { status: 200, headers: streamHeaders })
    }

    const { stream } = streamText({
      instructions: buildPersonalizedSystemPrompt(userSettings),
      model,
      messages,
      providerOptions: providerOptionsFor(info, thinking),
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
              if (providerErrorStatus(chunk.error) === 429) await reportProviderLimit(info.id)
              // Never forward or log the provider's own error text (it can echo request details)
              console.error(
                'Chat API stream error:',
                describeProviderError({ provider: info.provider, model: info.id }, chunk.error),
              )
              controller.enqueue(
                dataLine(
                  'error',
                  userFacingProviderError(chunk.error, getProviderDisplayName(info.provider), info.name),
                ),
              )
            }
          }
        } catch (error) {
          if (!req.signal.aborted) {
            if (providerErrorStatus(error) === 429) await reportProviderLimit(info.id)
            console.error(
              'Chat API stream error:',
              describeProviderError({ provider: info.provider, model: info.id }, error),
            )
            controller.enqueue(
              dataLine('error', userFacingProviderError(error, getProviderDisplayName(info.provider), info.name)),
            )
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(body, { status: 200, headers: streamHeaders })
  } catch (error) {
    console.error('Error in chat API:', describeProviderError({ provider: 'unknown', model: 'unknown' }, error))
    return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 })
  }
}
