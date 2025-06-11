import { streamText } from 'ai'
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

const mapModel = (modelId: string) => {
  // Find the model in our models collection
  const model = models.find(m => m.id === modelId)
  
  if (!model) {
    // Default fallback if model not found
    return google('gemini-2.0-flash')
  }
  
  // Handle Gemini models
  if (model.provider === 'gemini') {
    return google(modelId)
  }
  
  // Handle OpenRouter models
  if (model.provider === 'openrouter') {
    // OpenRouter models have full path in the ID
    return openrouter(modelId)
  }
  
  // Default fallback
  return google('gemini-2.0-flash')
}

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json()
    const { modelId } = data

    console.log(modelId)

    // TODO: Use a mapping from modelId to the correct provider and model name.
    // For now, we'll use a default Google model.
    const model = mapModel(modelId)
    console.log(model.modelId)
    const result = streamText({
      model: model,
      messages,
    })


    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    if (error instanceof Error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 })
  }
} 