"use node"
import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { betterAuthComponent } from "../auth";
import { models } from "../../src/lib/models"
// AI SDK imports for the action
import {
  streamText,
  wrapLanguageModel,
  extractReasoningMiddleware,
  smoothStream,
  tool,
  CoreMessage,
} from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import basePersonality from '../../prompts/base'
const mapModel = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
  
    if (!model) {
      return {
        model: null,
        thinking: false,
        provider: 'gemini' as const,
      };
    }
  
    return {
      model: model,
      thinking: model.supportsThinking || false,
      provider: model.provider,
    };
  };
  

export const sendMessage = action({
    args: {
      chatId: v.id("chats"),
      message: v.string(),
      modelId: v.string(),
      attachments: v.optional(v.array(v.object({
        name: v.string(),
        type: v.string(),
        size: v.number(),
        url: v.string(),
      }))),
      webSearch: v.optional(v.boolean()),
    },
    handler: async (ctx, { chatId, message, modelId, attachments, webSearch }): Promise<{
      success: boolean;
      userMessageId: Id<"messages">;
      assistantMessageId: Id<"messages">;
    }> => {
      // Verify authentication and chat ownership first
      const userId = await betterAuthComponent.getAuthUserId(ctx);
      if (!userId) {
        throw new Error("Authentication required");
      }
  
      const chat = await ctx.runQuery(api.chat.queries.getChat, { chatId });
      if (!chat) {
        throw new Error("Chat not found or access denied");
      }
  
  
  
      // Get chat history for context
      const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId });
  
          // Add user message to the database
      const userMessageId: Id<"messages"> = await ctx.runMutation(api.chat.mutations.addMessage, {
        chatId,
        role: "user",
        content: message,
        attachments
      });
  
      // Convert to AI SDK format
      const chatMessages: CoreMessage[] = messages
        .filter((msg: any) => msg.isComplete !== false)
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));
  
      // Add the new user message
      chatMessages.push({
        role: "user" as const,
        content: [{
          type: 'text',
          text: message
        }, ...(attachments ? attachments.map(file => ({
          type: 'image' as const,
          image: new URL(file.url.replace('blob:', ''))
        })) : [])
        ]
    })
      
  
      try {
        const { model, thinking, provider } = mapModel(modelId);
        
        if (!model) {
          throw new Error("Invalid model selected");
        }
  
        // Initialize AI providers
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY,
        });
  
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
        });
  
        const groq = createGroq({
          apiKey: process.env.GROQ_API_KEY,
        });
  
        let aiModel;
        if (provider === 'gemini') {
          aiModel = google(model.id);
        } else if (provider === 'openrouter') {
          aiModel = openrouter(model.id);
        } else if (provider === 'groq') {
          aiModel = groq(model.id);
        } else {
          aiModel = google('gemini-2.0-flash');
        }
  
        // Create assistant message placeholder
        const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.chat.mutations.addMessage, {
          chatId,
          role: "assistant",
          content: "",
          modelId,
          isComplete: false,
        });
  
        // Stream the response
        const { fullStream } = streamText({
          system: basePersonality,
          model: thinking
            ? wrapLanguageModel({
                model: aiModel,
                middleware: extractReasoningMiddleware({ 
                  tagName: 'think', 
                  startWithReasoning: true 
                }),
              })
            : aiModel,
          messages: chatMessages,
          tools: webSearch ? {
            search: tool({
              description: "Search the web for current information. Use this when you need up-to-date information that might not be in your training data.",
              parameters: z.object({
                query: z.string().describe("The search query to find relevant information"),
              }),
              execute: async ({ query }) => {
                try {
                  // Use Tavily API for web search
                  const response = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
                    },
                    body: JSON.stringify({
                      query,
                      search_depth: 'basic',
                      include_answer: true,
                      include_raw_content: false,
                      max_results: 5,
                    }),
                  });
  
                  if (!response.ok) {
                    throw new Error(`Search API error: ${response.status}`);
                  }
  
                  const data = await response.json();
                  
                  // Format the search results
                  const results = data.results?.map((result: any) => ({
                    title: result.title,
                    url: result.url,
                    content: result.content,
                  })) || [];
  
                  return {
                    query,
                    answer: data.answer || '',
                    results,
                    timestamp: new Date().toISOString(),
                  };
                } catch (error) {
                  console.error('Web search error:', error);
                  return {
                    query,
                    error: 'Failed to perform web search',
                    results: [],
                    timestamp: new Date().toISOString(),
                  };
                }
              },
            }),
          } : undefined,
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
          experimental_transform: [smoothStream({
            chunking: "word",
          })],
        });
  
        let accumulatedContent = "";
        let accumulatedThinking = "";
        let thinkingStartTime: number | null = null;
        let thinkingEndTime: number | null = null;
  
        for await (const chunk of fullStream) {
          // Check if the message has been cancelled
          const message = await ctx.runQuery(api.chat.queries.getMessage, { messageId: assistantMessageId });
          if (message?.isCancelled) {
            break;
          }

          if (chunk.type === 'text-delta') {
            accumulatedContent += chunk.textDelta;
            
            // Update the message in real-time
            await ctx.runMutation(api.chat.mutations.updateMessage, {
              messageId: assistantMessageId,
              content: accumulatedContent,
              isComplete: false,
            });
          } else if (chunk.type === 'reasoning') {
            // Track thinking start time
            if (!thinkingStartTime) {
              thinkingStartTime = Date.now();
            }
            
            if (provider === 'gemini') {
              // Handle Google's reasoning differently
              if (typeof chunk.textDelta === 'string' && chunk.textDelta.startsWith('**')) {
                // This is reasoning content - accumulate it
                accumulatedThinking += chunk.textDelta;
                
                // Update the message with thinking content
                await ctx.runMutation(api.chat.mutations.updateMessage, {
                  messageId: assistantMessageId,
                  thinking: accumulatedThinking,
                  isComplete: false,
                });
              } else {
                // This is regular content mixed with reasoning
                accumulatedContent += chunk.textDelta;
                await ctx.runMutation(api.chat.mutations.updateMessage, {
                  messageId: assistantMessageId,
                  content: accumulatedContent,
                  isComplete: false,
                });
              }
            } else {
              // For other providers, reasoning is separate
              accumulatedThinking += chunk.textDelta;
              
              // Update the message with thinking content
              await ctx.runMutation(api.chat.mutations.updateMessage, {
                messageId: assistantMessageId,
                thinking: accumulatedThinking,
                isComplete: false,
              });
            }
          } else if (chunk.type === 'finish') {
            // Track thinking end time
            if (thinkingStartTime && !thinkingEndTime) {
              thinkingEndTime = Date.now();
            }
            
            // Calculate thinking duration in seconds
            const duration = thinkingStartTime && thinkingEndTime 
              ? Math.round((thinkingEndTime - thinkingStartTime) / 1000) 
              : undefined;
            
            // Mark the message as complete with final thinking data
            await ctx.runMutation(api.chat.mutations.updateMessage, {
              messageId: assistantMessageId,
              content: accumulatedContent,
              thinking: accumulatedThinking || undefined,
              thinkingDuration: duration,
              isComplete: true,
            });
            break;
          } else if (chunk.type === 'error') {
            // Handle error
            await ctx.runMutation(api.chat.mutations.updateMessage, {
              messageId: assistantMessageId,
              content: accumulatedContent + "\n\n*Error occurred while generating response.*",
              thinking: accumulatedThinking || undefined,
              isComplete: true,
            });
            break;
          }
        }
  
        return {
          success: true,
          userMessageId,
          assistantMessageId,
        };
  
      } catch (error) {
        console.error('Error in sendMessage action:', error);
        
        // Add error message to chat
        await ctx.runMutation(api.chat.mutations.addMessage, {
          chatId,
          role: "assistant",
          content: "I apologize, but I encountered an error while processing your message. Please try again.",
          modelId,
        });
  
        throw error;
      }
    },
  }); 