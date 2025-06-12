import { streamText, wrapLanguageModel, extractReasoningMiddleware, smoothStream } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const maxDuration = 30

import { models } from '@/lib/models'
import basePersonality from '../../../../prompts/base';

const mapModel = (modelId: string) => {
  // Find the model in our models collection
  const model = models.find(m => m.id === modelId)
  
  if (!model) {
    // Default fallback if model not found
    return {
      model: google('gemini-2.0-flash'),
      thinking: false,
    }
  }
  
  // Handle Gemini models
  if (model.provider === 'gemini') {
    return {
      model: google(modelId),
      thinking: model.supportsThinking,
    }
  }
  
  // Handle OpenRouter models
  if (model.provider === 'openrouter') {
    // OpenRouter models have full path in the ID
    return {
      model: openrouter(modelId),
      thinking: false,
    }
  }
  
  // Default fallback
  return {
    model: google('gemini-2.0-flash'),
    thinking: false,
  }
}

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json()
    const { modelId } = data

    console.log(modelId)

    // TODO: Use a mapping from modelId to the correct provider and model name.
    // For now, we'll use a default Google model.
    const {model, thinking } = mapModel(modelId)
    console.log(model.modelId)
    const result = streamText({

      system: basePersonality,
      model: thinking ? wrapLanguageModel({
        model,
        middleware: extractReasoningMiddleware({ tagName: 'think', startWithReasoning: true }),
      }) : model,
      messages,
      providerOptions: {
        google: {
          thinkingConfig: thinking ? {
            includeThoughts: true,
            thinkingBudget: 2048,
          } : {},
        },
        openrouter: {}
      },
      experimental_transform: [
        smoothStream({
          chunking: 'word',
        }),
      ],
    })


    return result.toDataStreamResponse({
      sendReasoning: thinking,
    })
  } catch (error) {
    console.error('Error in chat API:', error)
    if (error instanceof Error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 })
  }
} 