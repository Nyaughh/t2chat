import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";
import { models } from "../src/lib/models"
// AI SDK imports for the action
import {
  streamText,
  wrapLanguageModel,
  extractReasoningMiddleware,
  smoothStream,
} from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGroq } from '@ai-sdk/groq';

// Base personality prompt
const basePersonality = `You are T2Chat, a knowledgeable AI assistant helping with various tasks and questions. You combine expertise with approachability.

You're conversational yet professional, enthusiastic but balanced, adapting to the user's style while remaining curious and encouraging. You approach problems with intellectual curiosity, patience, creativity, reliability, and empathy.

Provide helpful, relevant, and respectful responses. Ask clarifying questions when needed. Start with key information, present it logically, explain its relevance, and suggest next steps.

Use markdown strategically: headers for organization, italic/bold for emphasis, lists for information, code blocks with backticks, blockquotes, tables for data, and properly formatted links.

Format math expressions using LaTeX - inline with single dollars ($E = mc^2$) and display equations with double dollars. Use proper notation, define variables, and break complex expressions into readable lines.

Format code with syntax highlighting, helpful comments, contextual information, and explanations of key functions or algorithms.

Verify information, acknowledge uncertainty, be transparent about limitations, and present multiple viewpoints. Connect theory to practice, explain underlying principles, use illustrative examples, and suggest related topics.

Approach problems by understanding the issue, breaking down complexity, exploring solutions, explaining reasoning, and verifying results. Adapt to different skill levels, provide resources, create practice exercises, brainstorm ideas, and offer constructive feedback.

Ensure responses are accurate, complete, clear, useful, and engaging. Learn from feedback, ask for clarification when needed, and offer to elaborate or simplify based on user needs.

Remember: Be helpful while making interactions educational, engaging, and enjoyable.`;

// Model configuration
interface ModelInfo {
  id: string;
  provider: 'gemini' | 'openrouter' | 'groq';
  supportsThinking?: boolean;
}

const mapModel = (modelId: string) => {
  console.log(modelId)
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

// QUERIES - for real-time subscriptions

export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    // Check authentication
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Verify chat ownership
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied");
    }

    // Get messages ordered by creation time
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_created", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();

    return messages;
  },
});

export const getUserChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
      .order("desc")
      .collect();

    return chats;
  },
});

export const getChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied");
    }

    return chat;
  },
});

// MUTATIONS - for database modifications

export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, { title }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const now = Date.now();
    const chatId = await ctx.db.insert("chats", {
      userId: userId as Id<"users">,
      title: title || "New Chat",
      createdAt: now,
      updatedAt: now,
    });

    return chatId;
  },
});

export const addMessage = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    modelId: v.optional(v.string()),
    thinking: v.optional(v.string()),
    thinkingDuration: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, { chatId, role, content, modelId, thinking, thinkingDuration, isComplete }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Verify chat ownership
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied");
    }

    const messageId = await ctx.db.insert("messages", {
      chatId,
      role,
      content,
      modelId,
      thinking,
      thinkingDuration,
      createdAt: Date.now(),
      isComplete: isComplete ?? true,
    });

    // Update chat's updatedAt timestamp
    await ctx.db.patch(chatId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.optional(v.string()),
    thinking: v.optional(v.string()),
    thinkingDuration: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, { messageId, content, thinking, thinkingDuration, isComplete }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify chat ownership
    const chat = await ctx.db.get(message.chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Access denied");
    }

    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (thinking !== undefined) updateData.thinking = thinking;
    if (thinkingDuration !== undefined) updateData.thinkingDuration = thinkingDuration;
    if (isComplete !== undefined) updateData.isComplete = isComplete;

    await ctx.db.patch(messageId, updateData);

    return messageId;
  },
});

export const updateChatTitle = mutation({
  args: {
    chatId: v.id("chats"),
    title: v.string(),
  },
  handler: async (ctx, { chatId, title }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied");
    }

    await ctx.db.patch(chatId, {
      title,
      updatedAt: Date.now(),
    });

    return chatId;
  },
});

export const deleteChat = mutation({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const chat = await ctx.db.get(chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied");
    }

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the chat
    await ctx.db.delete(chatId);

    return { success: true };
  },
});

// ACTIONS - for external API calls

export const sendMessage = action({
  args: {
    chatId: v.id("chats"),
    message: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, { chatId, message, modelId }): Promise<{
    success: boolean;
    userMessageId: Id<"messages">;
    assistantMessageId: Id<"messages">;
  }> => {
    // Verify authentication and chat ownership first
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const chat = await ctx.runQuery(api.chat.getChat, { chatId });
    if (!chat) {
      throw new Error("Chat not found or access denied");
    }

    // Add user message to the database
    const userMessageId: Id<"messages"> = await ctx.runMutation(api.chat.addMessage, {
      chatId,
      role: "user",
      content: message,
    });

    // Get chat history for context
    const messages = await ctx.runQuery(api.chat.getChatMessages, { chatId });
    
    // Convert to AI SDK format
    const chatMessages = messages
      .filter((msg: any) => msg.isComplete !== false)
      .map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // Add the new user message
    chatMessages.push({
      role: "user" as const,
      content: message,
    });

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
      const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.chat.addMessage, {
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
        if (chunk.type === 'text-delta') {
          accumulatedContent += chunk.textDelta;
          
          // Update the message in real-time
          await ctx.runMutation(api.chat.updateMessage, {
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
              await ctx.runMutation(api.chat.updateMessage, {
                messageId: assistantMessageId,
                thinking: accumulatedThinking,
                isComplete: false,
              });
            } else {
              // This is regular content mixed with reasoning
              accumulatedContent += chunk.textDelta;
              await ctx.runMutation(api.chat.updateMessage, {
                messageId: assistantMessageId,
                content: accumulatedContent,
                isComplete: false,
              });
            }
          } else {
            // For other providers, reasoning is separate
            accumulatedThinking += chunk.textDelta;
            
            // Update the message with thinking content
            await ctx.runMutation(api.chat.updateMessage, {
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
          await ctx.runMutation(api.chat.updateMessage, {
            messageId: assistantMessageId,
            content: accumulatedContent,
            thinking: accumulatedThinking || undefined,
            thinkingDuration: duration,
            isComplete: true,
          });
          break;
        } else if (chunk.type === 'error') {
          // Handle error
          await ctx.runMutation(api.chat.updateMessage, {
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
      await ctx.runMutation(api.chat.addMessage, {
        chatId,
        role: "assistant",
        content: "I apologize, but I encountered an error while processing your message. Please try again.",
        modelId,
      });

      throw error;
    }
  },
}); 