import { useMemo } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export const useConvexChat = (chatId?: Id<"chats">) => {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Queries
  const messages = useQuery(
    api.chat.queries.getChatMessages,
    chatId && isAuthenticated ? { chatId } : "skip"
  );
  const chats = useQuery(
    api.chat.queries.getUserChats,
    isAuthenticated ? {} : "skip"
  );

  // Mutations & Actions
  const createChat = useMutation(api.chat.mutations.createChat);
  const sendMessage = useAction(api.chat.actions.sendMessage);
  const deleteChat = useMutation(api.chat.mutations.deleteChat);
  const updateChatTitle = useMutation(api.chat.mutations.updateChatTitle);

  const isStreaming = useMemo(() => {
    if (!messages) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage ? lastMessage.role === "assistant" && !lastMessage.isComplete : false;
  }, [messages]);
  
  return {
    // State
    isAuthenticated,
    isLoading,
    isStreaming,

    // Data
    messages,
    chats,

    // Functions
    createChat,
    sendMessage,
    deleteChat,
    updateChatTitle,
  };
}; 