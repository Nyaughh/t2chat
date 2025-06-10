"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Menu, Copy, Check, RotateCcw, Search, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence } from 'framer-motion';
import AIInput from "@/components/kokonutui/ai-input";
import MessageRenderer from "@/components/MessageRenderer";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import WelcomeScreen from "@/components/WelcomeScreen";
import { useSidebar } from "@/hooks/useSidebar";
import { useConversations } from "@/hooks/useConversations";
import { useTouch } from "@/hooks/useTouch";

export default function ChatInterface() {
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { 
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
    handleSendMessage
  } = useConversations();
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { onTouchStart, onTouchMove, onTouchEnd } = useTouch({
    onSwipeLeft: () => sidebarOpen && toggleSidebar()
  });

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
        handleSendMessage(previousMessage.content);
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

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  const handleSendWithAttachments = (message: string) => {
    handleSendMessage(message, pendingAttachments);
    setPendingAttachments([]);
    setInputValue("");
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
  };
  
  const showWelcomeScreen = messages.length === 0 && !isTyping && inputValue === "";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden transition-opacity duration-300"
          onClick={() => toggleSidebar()}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={cn(
          "bg-white/50 dark:bg-[oklch(0.18_0.015_25)]/20 backdrop-blur-sm flex flex-col h-screen transition-all duration-300 ease-in-out",
          "md:flex-shrink-0 md:shadow-none",
          sidebarOpen ? "md:w-64 md:opacity-100" : "md:w-0 md:opacity-0 md:overflow-hidden",
          "fixed md:relative z-50 md:z-auto shadow-2xl md:shadow-none",
          sidebarOpen 
            ? "w-80 opacity-100 left-0" 
            : "w-80 opacity-0 -left-80 overflow-hidden"
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="p-3 md:p-3 px-4 md:px-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 h-8 w-8 rounded-xl transition-all duration-200 hover:scale-110 group"
            >
              <Menu className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            </Button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">T2Chat</h1>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={createNewConversation}
              className={cn(
                "group w-full relative overflow-hidden bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12 text-rose-600 dark:text-rose-300 h-10 text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 dark:shadow-rose-500/10 dark:hover:shadow-rose-500/20 transition-all duration-300 ease-out backdrop-blur-sm",
                currentConversation && currentConversation.messages.length === 0 && "opacity-50 cursor-not-allowed"
              )}
              variant="ghost"
              disabled={currentConversation && currentConversation.messages.length === 0}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent dark:from-white/10 rounded-xl"></div>
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
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
        
        <div className="flex-1 min-h-0 px-3 md:px-3 px-4 md:px-3">
          <div className="h-full overflow-y-auto scrollbar-hide">
            <div className="space-y-1 py-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationSelect(conversation.id)}
                  className={`group px-3 py-3 md:py-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                    conversation.id === currentConversationId
                      ? "bg-rose-500/8 dark:bg-rose-300/8"
                      : "hover:bg-rose-500/5 dark:hover:bg-white/5 active:bg-rose-500/10 dark:active:bg-white/10"
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

        <div className="p-3 md:p-3 px-4 md:px-3 flex-shrink-0">
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full md:w-auto">
        {/* Theme Switcher */}
        <div className="absolute top-3 right-3 z-10">
          <ThemeSwitcher />
        </div>

        {/* Menu and New Chat buttons */}
        <div className={cn(
          "absolute top-3 left-3 z-30 transition-all duration-300 ease-in-out",
          sidebarOpen 
            ? "md:opacity-0" 
            : "opacity-100"
        )}>
          <div className="group relative p-2.5 rounded-xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 ease-out shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20 hover:shadow-xl hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10 flex items-center gap-2">
            {/* Gradient overlays for premium look */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-xl"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-xl"></div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5 w-5 p-0 hover:bg-transparent"
            >
              <Menu className="w-4 h-4" />
            </Button>
            
            {/* Vertical divider */}
            <div className="relative z-10 w-px h-4 bg-rose-500/20 dark:bg-rose-300/20"></div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={createNewConversation}
              className={cn(
                "relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5 w-5 p-0 hover:bg-transparent",
                currentConversation && currentConversation.messages.length === 0 && "opacity-30 cursor-not-allowed"
              )}
              title="New conversation"
              disabled={currentConversation && currentConversation.messages.length === 0}
            >
              <Plus className="w-4 h-4" />
            </Button>
            
            {/* Premium glow effect in dark mode */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
          </div>
        </div>
        
        {/* Welcome Screen or Messages */}
        <AnimatePresence mode="wait">
          {showWelcomeScreen ? (
            <WelcomeScreen key="welcome" onPromptClick={handlePromptClick} />
          ) : (
            <ScrollArea key="messages" className="h-full scrollbar-hide">
              <div className="absolute inset-0 overflow-hidden">
                <ScrollArea className="h-full scrollbar-hide">
                  <div className="pt-16 px-4 md:px-4 px-6 md:px-4 pb-40 md:pb-40 pb-48 md:pb-40 space-y-4 max-w-4xl mx-auto">
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
          </ScrollArea>
          )}
        </AnimatePresence>

        {/* AI Input */}
        <div className="fixed md:absolute bottom-0 left-0 right-0 z-30">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div className="max-w-2xl mx-auto w-full p-4 pb-4 md:pb-4">
            <AIInput 
              value={inputValue}
              onValueChange={setInputValue}
              onSend={handleSendWithAttachments}
              isTyping={isTyping}
              onAttachmentClick={() => fileInputRef.current?.click()}
              pendingAttachments={pendingAttachments}
              onRemoveAttachment={removeAttachment}
            />
          </div>
        </div>
      </div>

      {/* Premium subtle glow effect */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
    </div>
  );
} 