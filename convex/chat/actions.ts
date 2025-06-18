import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { betterAuthComponent } from "../auth";
import { generateText, CoreMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateAIResponse, basePersonality } from './shared';

export const retryMessage = action({
  args: {
    chatId: v.id("chats"),
    fromMessageId: v.id("messages"),
    modelId: v.string(),
    webSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, { chatId, fromMessageId, modelId, webSearch }): Promise<{
    success: boolean;
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

    try {
      // Delete messages from the retry point onwards
      await ctx.runMutation(api.chat.mutations.deleteMessagesFromIndex, {
        chatId,
        fromMessageId,
      });

      // Get remaining chat history for context
      const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId });
      
      // Convert to AI SDK format
      const chatMessages: CoreMessage[] = messages
        .filter((msg: any) => msg.isComplete !== false)
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

      // Create new assistant message placeholder
      const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.chat.mutations.addMessage, {
        chatId,
        role: "assistant",
        content: "",
        modelId,
        isComplete: false,
      });

      // Generate the AI response
      await generateAIResponse(ctx, chatMessages, modelId, assistantMessageId, webSearch);

      return {
        success: true,
        assistantMessageId,
      };

    } catch (error) {
      console.error('Error in retryMessage action:', error);
      
      // Add error message to chat
      await ctx.runMutation(api.chat.mutations.addMessage, {
        chatId,
        role: "assistant",
        content: "I apologize, but I encountered an error while retrying the message. Please try again.",
        modelId,
      });

      throw error;
    }
  },
});

// ACTIONS - for external API calls

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
      
      console.log("Using Node Runtime")
      return ctx.runAction(
      api.chat.wa.sendMessage, {
        chatId,
        message,
        modelId,
        attachments,
        webSearch
      }
    )
  

  // console.log("Using Convex Runtime")

  //   // Verify authentication and chat ownership first
  //   const userId = await betterAuthComponent.getAuthUserId(ctx);
  //   if (!userId) {
  //     throw new Error("Authentication required");
  //   }
  //   const chat = await ctx.runQuery(api.chat.queries.getChat, { chatId });
  //   if (!chat) {
  //     throw new Error("Chat not found or access denied");
  //   }


  //   // Get chat history for context
  //   const messages = await ctx.runQuery(api.chat.queries.getChatMessages, { chatId });

  //       // Add user message to the database
  //   const userMessageId: Id<"messages"> = await ctx.runMutation(api.chat.mutations.addMessage, {
  //     chatId,
  //     role: "user",
  //     content: message,
  //     attachments
  //   });
    
  //   // Convert to AI SDK format
  //   const chatMessages: CoreMessage[] = messages
  //     .filter((msg: any) => msg.isComplete !== false)
  //     .map((msg: any) => ({
  //       role: msg.role as "user" | "assistant",
  //       content: msg.content,
  //     }));

  //   // Add the new user message
  //   chatMessages.push({
  //     role: "user" as const,
  //     content: [{
  //       type: 'text',
  //       text: message
  //     }]
  // })
    

  //   try {
  //     // Create assistant message placeholder
  //     const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.chat.mutations.addMessage, {
  //       chatId,
  //       role: "assistant",
  //       content: "",
  //       modelId,
  //       isComplete: false,
  //     });

  //     // Generate the AI response
  //     await generateAIResponse(ctx, chatMessages, modelId, assistantMessageId, webSearch);

  //     return {
  //       success: true,
  //       userMessageId,
  //       assistantMessageId,
  //     };

  //   } catch (error) {
  //     console.error('Error in sendMessage action:', error);
      
  //     // Add error message to chat
  //     await ctx.runMutation(api.chat.mutations.addMessage, {
  //       chatId,
  //       role: "assistant",
  //       content: "I apologize, but I encountered an error while processing your message. Please try again.",
  //       modelId,
  //     });

  //     throw error;
  //   }
  },
});

export const generateTitle = action({
  args: {
    chatId: v.id("chats"),
    messageContent: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, { chatId, messageContent, modelId }) => {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

    const aiModel = google('gemini-2.0-flash-lite');

    // Fetch user settings to potentially customize title generation
    const userSettings = await ctx.runQuery(api.users.getMySettings);
    let titlePrompt = `Based on the following user message, generate a short, concise title for the chat (4-5 words max):\n\nUser: "${messageContent}"\n\nTitle:`;

    if (userSettings && userSettings.userName) {
      titlePrompt = `The user's name is ${userSettings.userName}. Based on their message, generate a short, concise title for the chat (4-5 words max):\n\nUser: "${messageContent}"\n\nTitle:`;
    }

    const { text } = await generateText({
      model: aiModel,
      prompt: titlePrompt,
    });
    
    let finalTitle = "";
    finalTitle = text;

    console.log("Final title:", finalTitle);
    await ctx.runMutation(api.chat.mutations.updateChatTitle, {
      chatId,
      title: finalTitle.replace(/"/g, ''),
    });
  }
}); 