"use client";

import { useState, useMemo } from "react";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  attachments?: File[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: Date;
}

const initialConversation: Conversation = {
  id: "1",
  title: "New Chat",
  messages: [],
  lastMessage: new Date(),
};

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([initialConversation]);
  const [currentConversationId, setCurrentConversationId] = useState("1");
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentConversation = useMemo(
    () => conversations.find(conv => conv.id === currentConversationId),
    [conversations, currentConversationId]
  );

  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation]
  );

  const filteredConversations = useMemo(() => 
    conversations.filter(conv =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.messages.some(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ),
    [conversations, searchQuery]
  );

  const generateTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  };

  const createNewConversation = () => {
    // Don't create a new chat if current one is empty
    if (currentConversation && currentConversation.messages.length === 0) {
      return;
    }
    
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      lastMessage: new Date(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  };

  const deleteConversation = (conversationId: string) => {
    if (conversations.length <= 1) return;
    
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    if (currentConversationId === conversationId) {
      const remainingConvs = conversations.filter(conv => conv.id !== conversationId);
      setCurrentConversationId(remainingConvs[0]?.id || "");
    }
  };

  const addMessageToCurrentConversation = (message: Message) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === currentConversationId) {
          const updatedMessages = [...conv.messages, message];
          let title = conv.title;
          
          if (conv.messages.length === 0 && message.role === "user") {
            title = generateTitle(message.content);
          }
          
          return {
            ...conv,
            messages: updatedMessages,
            lastMessage: new Date(),
            title
          };
        }
        return conv;
      })
    );
  };

  const simulateAIResponse = (userMessage: string) => {
    setIsTyping(true);
    
    setTimeout(() => {
      const responses = [
        "I understand your question. Let me provide you with a comprehensive answer that addresses your specific needs.",
        "That's a great question! Based on my analysis, here are some insights that might be helpful for you.",
        "I've processed your request and I'm ready to assist you with this. Here's what I recommend:",
        "Excellent! I can definitely help you with that. Let me break this down for you in a clear and actionable way.",
        "Thank you for that question. I've analyzed the context and here's my detailed response:",
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      const newMessage: Message = {
        id: Date.now().toString(),
        content: response,
        role: "assistant",
        timestamp: new Date(),
      };

      addMessageToCurrentConversation(newMessage);
      setIsTyping(false);
    }, 1200);
  };

  const handleSendMessage = (message: string, attachments: File[] = []) => {
    if ((!message.trim() && attachments.length === 0) || !currentConversation) return;

    const content = message.trim() || (attachments.length > 0 ? `Uploaded files: ${attachments.map(f => f.name).join(', ')}` : '');
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    addMessageToCurrentConversation(newMessage);
    simulateAIResponse(content);
  };

  return {
    conversations,
    currentConversationId,
    currentConversation,
    messages,
    isTyping,
    searchQuery,
    filteredConversations,
    createNewConversation,
    setCurrentConversationId,
    setSearchQuery,
    deleteConversation,
    handleSendMessage,
  };
} 