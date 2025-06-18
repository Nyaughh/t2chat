'use node'
import { v } from 'convex/values'
import { api } from '../_generated/api'
import { Id } from '../_generated/dataModel'
import { models } from '../../src/lib/models'
import { streamText, wrapLanguageModel, extractReasoningMiddleware, smoothStream, tool, CoreMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { Modality } from '@google/genai'

// Base personality prompt
export const basePersonality = `You are T2Chat, a knowledgeable AI assistant helping with various tasks and questions. You combine expertise with approachability.

You're conversational yet professional, enthusiastic but balanced, adapting to the user's style while remaining curious and encouraging. You approach problems with intellectual curiosity, patience, creativity, reliability, and empathy.

Provide helpful, relevant, and respectful responses. Ask clarifying questions when needed. Start with key information, present it logically, explain its relevance, and suggest next steps.

**IMPORTANT: When you need to use tools (like generating images or searching), always explain what you're going to do BEFORE calling the tool. Provide context and describe your plan in conversational text first.**

Use markdown strategically: headers for organization, italic/bold for emphasis, lists for information, code blocks with backticks, blockquotes, tables for data, and hyperlinks (avoid displaying raw URLs in the texx).

Format math expressions using LaTeX - inline with single dollars ($E = mc^2$) and display equations with double dollars. Use proper notation, define variables, and break complex expressions into readable lines.

Format code with syntax highlighting, helpful comments, contextual information, and explanations of key functions or algorithms.

Verify information, acknowledge uncertainty, be transparent about limitations, and present multiple viewpoints. Connect theory to practice, explain underlying principles, use illustrative examples, and suggest related topics.

Approach problems by understanding the issue, breaking down complexity, exploring solutions, explaining reasoning, and verifying results. Adapt to different skill levels, provide resources, create practice exercises, brainstorm ideas, and offer constructive feedback.

Ensure responses are accurate, complete, clear, useful, and engaging. Learn from feedback, ask for clarification when needed, and offer to elaborate or simplify based on user needs.

Remember: Be helpful while making interactions educational, engaging, and enjoyable.`

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

// Helper function to generate AI response
export const generateAIResponse = async (
  ctx: any,
  chatMessages: CoreMessage[],
  modelId: string,
  assistantMessageId: Id<'messages'>,
  webSearch?: boolean,
) => {
  const { model, thinking, provider } = mapModel(modelId)

  console.log('model', model)

  if (!model) {
    throw new Error('Invalid model selected')
  }

  // Get user's API keys for different providers
  const userGeminiKey = await ctx.runQuery(api.api_keys.getUserDefaultApiKey, { service: 'gemini' })
  const userGroqKey = await ctx.runQuery(api.api_keys.getUserDefaultApiKey, { service: 'groq' })
  const userOpenRouterKey = await ctx.runQuery(api.api_keys.getUserDefaultApiKey, { service: 'openrouter' })

  // Initialize AI providers with user keys when available, fallback to system keys

  console.log('userGeminiKey', userGeminiKey)
  console.log('userGroqKey', userGroqKey)
  console.log('userOpenRouterKey', userOpenRouterKey)

  const google = createGoogleGenerativeAI({
    apiKey: userGeminiKey || process.env.GEMINI_API_KEY,
  })

  const openrouter = createOpenRouter({
    apiKey: userOpenRouterKey || process.env.OPENROUTER_API_KEY,
  })

  const groq = createGroq({
    apiKey: userGroqKey || process.env.GROQ_API_KEY,
  })

  let aiModel
  if (provider === 'gemini') {
    aiModel = google(model.id)
  } else if (provider === 'openrouter') {
    aiModel = openrouter(model.id)
  } else if (provider === 'groq') {
    aiModel = groq(model.id)
  } else {
    aiModel = google('gemini-2.0-flash')
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

  // Determine which key to use for image generation
  const shouldUseUserGeminiKey = !!userGeminiKey

  // Prepare tools
  const tools: any = {}

  if (webSearch) {
    tools.search = tool({
      description:
        "Search the web for current information. Use this when you need up-to-date information that might not be in your training data. IMPORTANT: Always explain what you're searching for and why before calling this tool.",
      parameters: z.object({
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
      parameters: z.object({
        prompt: z.string().describe('The detailed description of the image to generate'),
      }),
      execute: async ({ prompt }) => {
        try {
          // Use user's key if available, otherwise use system key
          const apiKey = shouldUseUserGeminiKey ? userGeminiKey : process.env.GEMINI_API_KEY

          // Use Google Gen AI SDK for image generation
          const { GoogleGenAI } = await import('@google/genai')
          const genAI = new GoogleGenAI({ apiKey })

          const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: prompt,
            config: {
              responseModalities: [Modality.IMAGE, Modality.TEXT], // Fixed: IMAGE first, then TEXT
            },
          })

          console.log('Image generation result', result)

          const parts = result.candidates?.[0]?.content?.parts || []
          let imageData = null
          let description = ''

          for (const part of parts) {
            if (part.text) {
              description += part.text
            } else if (part.inlineData) {
              imageData = part.inlineData.data
            }
          }

          if (imageData) {
            // Convert base64 to buffer and store in Convex
            const imageBuffer = Buffer.from(imageData, 'base64')

            // Store the image in Convex file storage
            const storageId = await ctx.storage.store(new Blob([imageBuffer], { type: 'image/png' }))

            // Get the public URL for the stored image
            const imageUrl = await ctx.storage.getUrl(storageId)

            return {
              success: true,
              prompt: prompt,
              description: description,
              imageUrl: imageUrl,
              storageId: storageId,
              timestamp: new Date().toISOString(),
              usedUserKey: shouldUseUserGeminiKey,
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
          console.error('Image generation error:', error)
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
  // Stream the response
  const { fullStream } = streamText({
    system: personalizedSystemPrompt,
    model: thinking
      ? wrapLanguageModel({
          model: aiModel,
          middleware: extractReasoningMiddleware({
            tagName: 'think',
            startWithReasoning: true,
          }),
        })
      : aiModel,
    messages: chatMessages,
    maxSteps: 20,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    // Add explicit instruction to generate explanatory text before tool calls
    toolChoice: Object.keys(tools).length > 0 ? 'auto' : undefined,
    // Add temperature to encourage more varied responses
    temperature: 0.7,
    // Encourage more text generation
    maxTokens: provider === 'openrouter' ? 4000 : undefined,
    providerOptions: {
      google: {
        thinkingConfig: thinking
          ? {
              thinkingBudget: 2048,
            }
          : {},
        // Add Google-specific options to encourage text generation
        candidateCount: 1,
        safetySettings: [],
      },
      openrouter: {
        // Add OpenRouter specific options
        transforms: ['middle-out'],
      },
    },
    experimental_transform: [
      smoothStream({
        chunking: 'word',
      }),
    ],
  })

  let accumulatedContent = ''
  let accumulatedThinking = ''
  let thinkingStartTime: number | null = null
  let thinkingEndTime: number | null = null
  let accumulatedToolCalls: any[] = []
  let hasGeneratedTextBeforeTools = false

  for await (const chunk of fullStream) {
    try {
      // Check if the message has been cancelled
      const message = await ctx.runQuery(api.chat.queries.getMessage, { messageId: assistantMessageId })
      if (message?.isCancelled) {
        break
      }

      // Enhanced debugging for all chunk types
      console.log(
        'Received chunk type:',
        chunk.type,
        Object.keys(tools).length > 0 ? '(tools available)' : '(no tools)',
      )

      if (chunk.type === 'text-delta') {
        console.log('Text delta received:', chunk.textDelta?.substring(0, 50) + '...')
        accumulatedContent += chunk.textDelta
        hasGeneratedTextBeforeTools = true

        // Update the message in real-time with error handling
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent,
          isComplete: false,
        })
      } else if (chunk.type === 'reasoning') {
        // Track thinking start time
        if (!thinkingStartTime) {
          thinkingStartTime = Date.now()
        }

        if (provider === 'gemini') {
          console.log('gemini reasoning', chunk)
          // Handle Google's reasoning differently
          if (typeof chunk.textDelta === 'string' && chunk.textDelta.startsWith('**')) {
            // This is reasoning content - accumulate it
            accumulatedThinking += chunk.textDelta

            // Update the message with thinking content
            await ctx.runMutation(api.chat.mutations.updateMessage, {
              messageId: assistantMessageId,
              thinking: accumulatedThinking,
              isComplete: false,
            })
          } else {
            // This is regular content mixed with reasoning
            accumulatedContent += chunk.textDelta
            await ctx.runMutation(api.chat.mutations.updateMessage, {
              messageId: assistantMessageId,
              content: accumulatedContent,
              isComplete: false,
            })
          }
        } else {
          // For other providers, reasoning is separate
          accumulatedThinking += chunk.textDelta

          // Update the message with thinking content
          await ctx.runMutation(api.chat.mutations.updateMessage, {
            messageId: assistantMessageId,
            thinking: accumulatedThinking,
            isComplete: false,
          })
        }
      } else if (chunk.type === 'tool-call') {
        console.log('Tool call received:', chunk.toolName, 'with args:', JSON.stringify(chunk.args))

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
          args: chunk.args,
        })
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent,
          toolCalls: accumulatedToolCalls,
        })
      } else if (chunk.type === 'tool-result') {
        console.log('Tool result received for:', chunk.toolCallId)
        const toolCall = accumulatedToolCalls.find((tc) => tc.toolCallId === chunk.toolCallId)
        if (toolCall) {
          toolCall.result = chunk.result
        }
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          toolCalls: accumulatedToolCalls,
        })
      } else if (chunk.type === 'finish') {
        console.log('Stream finished. Final content length:', accumulatedContent.length)
        // Track thinking end time
        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now()
        }

        // Calculate thinking duration in seconds
        const duration =
          thinkingStartTime && thinkingEndTime ? Math.round((thinkingEndTime - thinkingStartTime) / 1000) : undefined

        // Mark the message as complete with final thinking data
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent,
          thinking: accumulatedThinking || undefined,
          thinkingDuration: duration,
          isComplete: true,
          toolCalls: accumulatedToolCalls,
        })
        break
      } else if (chunk.type === 'error') {
        console.log('Stream error:', chunk)
        // Handle error
        await ctx.runMutation(api.chat.mutations.updateMessage, {
          messageId: assistantMessageId,
          content: accumulatedContent + '\n\n*Error occurred while generating response.*',
          thinking: accumulatedThinking || undefined,
          isComplete: true,
        })
        break
      } else {
        // Log any unknown chunk types for debugging
        console.log('Unknown chunk type received:', chunk.type, chunk)
      }
    } catch (updateError) {
      // If we can't update the message (e.g., due to conflicts), continue streaming
      // but don't fail the entire operation
      console.warn('Failed to update message during streaming:', updateError)
    }
  }

  // Ensure the message is marked as complete even if the loop exits unexpectedly
  try {
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
