import { streamText, wrapLanguageModel, extractReasoningMiddleware, createDataStreamResponse } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createGroq } from '@ai-sdk/groq'

import { models } from '@/lib/models'
import { basePersonality } from '../../../../prompts/base'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
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

const mapModel = (modelId: string) => {
  const model = models.find((m) => m.id === modelId)

  if (!model) {
    return {
      model: google('gemini-2.0-flash'),
      thinking: false,
    }
  }

  if (model.provider === 'gemini') {
    return {
      model: google(modelId),
      thinking: model.supportsThinking,
    }
  }

  if (model.provider === 'openrouter') {
    return {
      model: openrouter(modelId),
      thinking: false,
    }
  }

  if (model.provider === 'groq') {
    return {
      model: groq(modelId),
      thinking: model.supportsThinking,
    }
  }

  return {
    model: google('gemini-2.0-flash'),
    thinking: false,
  }
}

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json()
    const { modelId, userSettings } = data

    const { model, thinking } = mapModel(modelId)
    const systemPrompt = buildPersonalizedSystemPrompt(userSettings)

    const { fullStream } = streamText({
      system: systemPrompt,
      model: thinking
        ? wrapLanguageModel({
            model,
            middleware: extractReasoningMiddleware({ tagName: 'think', startWithReasoning: true }),
          })
        : model,
      messages,
      providerOptions: {
        google: {
          thinkingConfig: thinking
            ? {
                thinkingBudget: 2048,
              }
            : {},
        },
        openrouter: {},
      },
      experimental_transform: [],
    })

    console.log('MODEL', model.provider)

    return createDataStreamResponse({
      status: 200,
      statusText: 'OK',
      headers: {
        'Custom-Header': 'value',
      },
      execute: async (dataStream) => {
        let thinkingStartTime: number | null = null
        let thinkingEndTime: number | null = null

        for await (const chunk of fullStream) {
          if (chunk.type === 'text-delta') {
            dataStream.writeData({
              type: 'text',
              value: chunk.textDelta,
            })
          } else if (chunk.type === 'reasoning') {
            // Track thinking timing
            if (!thinkingStartTime) {
              thinkingStartTime = Date.now()
            }

            if (model.provider === 'google.generative-ai') {
              console.log('GOOGLE REASONING', chunk.textDelta)
              if (typeof chunk.textDelta === 'string' && chunk.textDelta.startsWith('**')) {
                dataStream.writeData({
                  type: 'reasoning',
                  value: chunk.textDelta,
                })
                continue
              } else {
                dataStream.writeData({
                  type: 'text',
                  value: chunk.textDelta,
                })
              }
              continue
            }

            dataStream.writeData({
              type: 'reasoning',
              value: chunk.textDelta,
            })
          } else if (chunk.type === 'finish') {
            // Calculate thinking duration
            if (thinkingStartTime && !thinkingEndTime) {
              thinkingEndTime = Date.now()
            }

            const thinkingDuration =
              thinkingStartTime && thinkingEndTime
                ? Math.round((thinkingEndTime - thinkingStartTime) / 1000)
                : undefined

            dataStream.writeData({
              type: 'finish',
              value: {
                finishReason: chunk.finishReason || 'unknown',
                usage: chunk.usage || {},
                ...(thinkingDuration && { thinkingDuration }),
              },
            })
          } else if (chunk.type === 'error') {
            dataStream.writeData({
              type: 'error',
              value: (chunk.error as { message: string })?.message || 'Unknown error',
            })
          }
        }
      },
    })
  } catch (error) {
    console.error('Error in chat API:', error)
    if (error instanceof Error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 })
  }
}
