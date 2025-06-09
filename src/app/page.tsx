"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Menu, Copy, Check, RotateCcw, Search, X, Paperclip } from "lucide-react";
import AIInput from "@/components/kokonutui/ai-input";
import MessageRenderer from "@/components/MessageRenderer";
import ThemeSwitcher from "@/components/ThemeSwitcher";

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

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "1",
      title: "New Chat",
      messages: [],
      lastMessage: new Date(),
    },
  ]);
  
  const [currentConversationId, setCurrentConversationId] = useState("1");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConversation = conversations.find(conv => conv.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const generateTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  };

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      lastMessage: new Date(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  };

  const updateConversationTitle = (conversationId: string, newTitle: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title: newTitle }
          : conv
      )
    );
  };

  const deleteConversation = (conversationId: string) => {
    if (conversations.length <= 1) return; // Keep at least one conversation
    
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    if (currentConversationId === conversationId) {
      const remainingConvs = conversations.filter(conv => conv.id !== conversationId);
      setCurrentConversationId(remainingConvs[0]?.id || "");
    }
  };

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleRegenerate = (messageId: string) => {
    if (!currentConversation) return;
    
    const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex > 0) {
      const previousMessage = currentConversation.messages[messageIndex - 1];
      if (previousMessage.role === "user") {
        // Remove messages from this point onwards
        const updatedMessages = currentConversation.messages.slice(0, messageIndex);
        setConversations(prev => 
          prev.map(conv => 
            conv.id === currentConversationId 
              ? { ...conv, messages: updatedMessages, lastMessage: new Date() }
              : conv
          )
        );
        simulateAIResponse(previousMessage.content);
      }
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    setPendingAttachments(prev => [...prev, ...fileArray]);
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
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
        "I see you've shared some files with me. I can help you analyze, process, or work with this content in various ways.",
        `Here's a sample React component that demonstrates the concept:

\`\`\`jsx
import React, { useState } from 'react';

const ExampleComponent = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold">Counter: {count}</h1>
      <button 
        onClick={() => setCount(count + 1)}
                 className="mt-2 px-4 py-2 bg-rose-500 text-white rounded"
      >
        Increment
      </button>
    </div>
  );
};

export default ExampleComponent;
\`\`\`

This shows how to use \`useState\` hook for state management and basic styling with Tailwind CSS.`,
        `Let me show you a Python solution for this problem:

\`\`\`python
def fibonacci(n):
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])
    
    return sequence

# Example usage
result = fibonacci(10)
print(f"First 10 Fibonacci numbers: {result}")
\`\`\`

The function uses a simple iterative approach with \`O(n)\` time complexity.`,
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

  const addMessageToCurrentConversation = (message: Message) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === currentConversationId) {
          const updatedMessages = [...conv.messages, message];
          let title = conv.title;
          
          // Update title if it's a new conversation or default title
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

  const handleSendMessage = (message: string) => {
    if ((!message.trim() && pendingAttachments.length === 0) || !currentConversation) return;

    const content = message.trim() || (pendingAttachments.length > 0 ? `Uploaded files: ${pendingAttachments.map(f => f.name).join(', ')}` : '');
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
    };

    addMessageToCurrentConversation(newMessage);
    simulateAIResponse(content);
    setPendingAttachments([]); // Clear pending attachments after sending
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.messages.some(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - Fixed */}
      {sidebarOpen && (
        <div className="w-64 bg-white/50 dark:bg-[oklch(0.18_0.015_25)]/20 backdrop-blur-sm flex flex-col flex-shrink-0 h-screen">
          <div className="p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 h-7 w-7"
              >
                <Menu className="w-3.5 h-3.5" />
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">T2Chat</h1>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={createNewConversation}
                className="group w-full relative overflow-hidden bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12 text-rose-600 dark:text-rose-300 h-10 text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 dark:shadow-rose-500/10 dark:hover:shadow-rose-500/20 transition-all duration-300 ease-out backdrop-blur-sm"
                variant="ghost"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent dark:from-white/10 rounded-xl"></div>
                <span className="relative z-10 tracking-[0.5px] group-hover:tracking-wide transition-all duration-300 ease-out">New chat</span>
              </Button>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/50 dark:text-white/50" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-transparent text-sm text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="h-px bg-black/10 dark:bg-white/10 mt-3"></div>
          </div>
          
          <div className="flex-1 min-h-0 px-3">
            <div className="h-full overflow-y-auto scrollbar-hide">
              <div className="space-y-1 py-2">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setCurrentConversationId(conversation.id)}
                    className={`group px-3 py-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                      conversation.id === currentConversationId
                        ? "bg-rose-500/8 dark:bg-rose-300/8"
                        : "hover:bg-rose-500/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${
                          conversation.id === currentConversationId
                            ? "text-rose-600 dark:text-rose-300"
                            : "text-black/70 dark:text-white/70"
                        }`}>
                          {conversation.title}
                        </div>
                      </div>
                      {conversations.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 -m-1 text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 flex-shrink-0">
            <Button
              variant="ghost"
              className="group w-full justify-start h-auto px-3 py-2 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/5 hover:from-rose-500/10 hover:to-rose-500/10 dark:hover:from-rose-300/10 dark:hover:to-rose-300/10 border border-rose-500/10 dark:border-rose-300/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 rounded-lg backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 w-full">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-rose-500/30 dark:bg-rose-300/30"></div>
                </div>
                <div className="flex-1 text-center min-w-0">
                  <div className="text-sm font-medium text-black/80 dark:text-white/80 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
                    Sign in
                  </div>
                </div>
                <div className="w-3.5 h-3.5 text-black/40 dark:text-white/40 group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors flex-shrink-0">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Theme Switcher - Fixed Top Right */}
        <div className="absolute top-3 right-3 z-10">
          <ThemeSwitcher />
        </div>

        {/* Menu and New Chat buttons when sidebar is closed - Fixed */}
        {!sidebarOpen && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 h-7 w-7"
            >
              <Menu className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={createNewConversation}
              className="text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 h-7 w-7"
              title="New conversation"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Messages - Scrollable behind input */}
        {messages.length > 0 && (
          <div className="absolute inset-0 overflow-hidden">
            <ScrollArea className="h-full scrollbar-hide">
              <div className="pt-20 px-4 pb-40 space-y-4 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="group flex flex-col gap-2 max-w-[85%] min-w-0">
                      <div
                        className={`px-4 py-3 break-words overflow-wrap-anywhere ${
                          message.role === "user"
                            ? "bg-rose-500/5 dark:bg-rose-300/5 text-black dark:text-white rounded-lg"
                            : "text-black dark:text-white"
                        }`}
                      >
                        <MessageRenderer 
                          content={message.content} 
                          className="text-sm leading-normal break-words overflow-wrap-anywhere"
                        />
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.attachments.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded px-2 py-1"
                              >
                                <Paperclip className="w-3 h-3" />
                                <span className="text-xs truncate max-w-32">{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(message.content, message.id)}
                            className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                            title="Copy message"
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRegenerate(message.id)}
                            className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                            title="Regenerate response"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="text-black dark:text-white px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}

        {/* AI Input - Position changes based on conversation state */}
        <div className={`z-30 ${
          messages.length === 0 
            ? "absolute top-1/2 left-0 right-0 transform -translate-y-1/2" 
            : "absolute bottom-0 left-0 right-0"
        }`}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div className={`${messages.length === 0 ? "" : ""} max-w-2xl mx-auto w-full p-4`}>
            <AIInput 
              onSend={handleSendMessage} 
              isTyping={isTyping}
              onAttachmentClick={() => fileInputRef.current?.click()}
              pendingAttachments={pendingAttachments}
              onRemoveAttachment={removeAttachment}
            />
          </div>
        </div>
      </div>

      {/* Premium subtle glow effect in dark mode */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
    </div>
  );
}
