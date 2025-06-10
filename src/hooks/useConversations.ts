"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

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

const STORAGE_KEY = "t2chat-conversations";
const CURRENT_CONVERSATION_KEY = "t2chat-current-conversation";

export function useConversations() {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const savedConversations = localStorage.getItem(STORAGE_KEY);
      const savedCurrentId = localStorage.getItem(CURRENT_CONVERSATION_KEY);
      
      if (savedConversations) {
        const parsed = JSON.parse(savedConversations);
        // Convert timestamps back to Date objects
        const conversations = parsed.map((conv: any) => ({
          ...conv,
          lastMessage: new Date(conv.lastMessage),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setConversations(conversations);
        
        // Set current conversation based on URL or localStorage
        const pathMatch = pathname.match(/\/chat\/([^\/]+)/);
        if (pathMatch) {
          const urlId = pathMatch[1];
          if (conversations.find((c: Conversation) => c.id === urlId)) {
            setCurrentConversationId(urlId);
          } else {
            // If URL has invalid ID, redirect to home
            router.replace('/');
          }
        } else if (pathname === '/' || pathname === '') {
          // If we're on home page, don't set any current conversation
          setCurrentConversationId("");
        } else if (savedCurrentId && conversations.find((c: Conversation) => c.id === savedCurrentId)) {
          setCurrentConversationId(savedCurrentId);
        } else if (conversations.length > 0) {
          setCurrentConversationId(conversations[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading conversations from localStorage:", error);
    }
  }, [pathname, router]);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined" || conversations.length === 0) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error("Error saving conversations to localStorage:", error);
    }
  }, [conversations]);

  // Save current conversation ID to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !currentConversationId) return;
    
    try {
      localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
    } catch (error) {
      console.error("Error saving current conversation ID:", error);
    }
  }, [currentConversationId]);

  const currentConversation = useMemo(
    () => conversations.find(conv => conv.id === currentConversationId),
    [conversations, currentConversationId]
  );

  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation]
  );

  // Only show conversations that have messages
  const conversationsWithMessages = useMemo(() => 
    conversations.filter(conv => conv.messages.length > 0),
    [conversations]
  );

  const filteredConversations = useMemo(() => 
    conversationsWithMessages.filter(conv =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.messages.some(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ),
    [conversationsWithMessages, searchQuery]
  );

  const generateTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  };

  // Modified to navigate to home instead of creating a conversation
  const createNewConversation = useCallback(() => {
    // Clear current conversation and navigate to home
    setCurrentConversationId("");
    // Also clear from localStorage to prevent auto-loading
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_CONVERSATION_KEY);
    }
    router.push('/');
  }, [router]);

  const deleteConversation = useCallback((conversationId: string) => {
    if (conversationsWithMessages.length <= 1) return;
    
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    if (currentConversationId === conversationId) {
      const remainingConvs = conversationsWithMessages.filter(conv => conv.id !== conversationId);
      if (remainingConvs.length > 0) {
        const nextId = remainingConvs[0].id;
        setCurrentConversationId(nextId);
        router.push(`/chat/${nextId}`);
      } else {
        // If no conversations left, go to home
        setCurrentConversationId("");
        router.push('/');
      }
    }
  }, [conversationsWithMessages, currentConversationId, router]);

  const navigateToConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
    router.push(`/chat/${conversationId}`);
  }, [router]);

  const addMessageToCurrentConversation = useCallback((message: Message) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === currentConversationId) {
          const updatedMessages = [...conv.messages, message];
          let title = conv.title;
          
          // Generate title from first user message
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
  }, [currentConversationId]);

  const stopGeneratingResponse = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setIsTyping(false);
    addMessageToCurrentConversation({
      id: uuidv4(),
      role: 'assistant',
      content: 'Stopped by the user',
      timestamp: new Date(),
    });
  }, [addMessageToCurrentConversation]);

  const simulateAIResponse = useCallback((userMessage: string) => {
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      const responses = [
        "I understand your question. Let me provide you with a comprehensive answer that addresses your specific needs.",
        "That's a great question! Based on my analysis, here are some insights that might be helpful for you.",
        "I've processed your request and I'm ready to assist you with this. Here's what I recommend:",
        "Excellent! I can definitely help you with that. Let me break this down for you in a clear and actionable way.",
        "Thank you for that question. I've analyzed the context and here's my detailed response:",
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      const newMessage: Message = {
        id: uuidv4(),
        content: response,
        role: "assistant",
        timestamp: new Date(),
      };

      addMessageToCurrentConversation(newMessage);
      setIsTyping(false);
      typingTimeoutRef.current = null;
    }, 1200);
  }, [addMessageToCurrentConversation]);

  // Effect to automatically trigger AI response
  useEffect(() => {
    const lastMessage = currentConversation?.messages?.[currentConversation.messages.length - 1];
    
    if (lastMessage?.role === 'user' && !isTyping) {
      simulateAIResponse(lastMessage.content);
    }
  }, [currentConversation, isTyping, simulateAIResponse]);

  const regenerateResponse = useCallback((assistantMessageId: string) => {
    if (!currentConversation) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === assistantMessageId);

    if (messageIndex === -1) return;

    // Remove all messages from the one we are regenerating onwards
    const newMessages = currentConversation.messages.slice(0, messageIndex);

    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversationId
          ? { ...conv, messages: newMessages, lastMessage: new Date() }
          : conv
      )
    );
  }, [currentConversation, currentConversationId]);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (!currentConversation) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Update the message content and remove all subsequent messages
    const updatedMessages = currentConversation.messages.slice(0, messageIndex + 1);
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: newContent,
      timestamp: new Date(),
    };

    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversationId
          ? { ...conv, messages: updatedMessages, lastMessage: new Date() }
          : conv
      )
    );
  }, [currentConversation, currentConversationId]);

  const handleSendMessage = useCallback((message: string, attachments: File[] = []) => {
    if (!message.trim() && attachments.length === 0) return;

    const content = message.trim() || (attachments.length > 0 ? `Uploaded files: ${attachments.map(f => f.name).join(', ')}` : '');
    
    let conversationId = currentConversationId;
    let isNewConversation = false;
    
    // If no current conversation exists or we're on the home page, create a new conversation
    if (!conversationId || !currentConversation || pathname === '/') {
      isNewConversation = true;
      conversationId = uuidv4();
      const newConv: Conversation = {
        id: conversationId,
        title: generateTitle(content), // Set title immediately from first message
        messages: [],
        lastMessage: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversationId(conversationId);
    }

    const newMessage: Message = {
      id: uuidv4(),
      content,
      role: "user",
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Update the conversations state to add the message
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          const updatedMessages = [...conv.messages, newMessage];
          
          return {
            ...conv,
            messages: updatedMessages,
            lastMessage: new Date(),
          };
        }
        return conv;
      })
    );

    if (isNewConversation) {
      router.push(`/chat/${conversationId}`);
    }
  }, [currentConversationId, currentConversation, pathname, router]);

  return {
    conversations: conversationsWithMessages, // Only return conversations with messages
    currentConversationId,
    currentConversation,
    messages,
    isTyping,
    searchQuery,
    filteredConversations,
    createNewConversation,
    setCurrentConversationId: navigateToConversation,
    setSearchQuery,
    deleteConversation,
    handleSendMessage,
    stopGeneratingResponse,
    regenerateResponse,
    editMessage,
  };
} 