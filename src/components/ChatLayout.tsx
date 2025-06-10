"use client";

import { Button } from "@/components/ui/button";
import { Plus, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useSidebar } from "@/hooks/useSidebar";
import { useConversations } from "@/hooks/useConversations";
import { useTouch } from "@/hooks/useTouch";
import { useState, useEffect } from "react";

interface ChatLayoutProps {
  children: React.ReactNode;
}

export default function ChatLayout({ children }: ChatLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { 
    conversations,
    currentConversationId,
    currentConversation,
    searchQuery,
    filteredConversations,
    createNewConversation,
    setCurrentConversationId,
    setSearchQuery,
    deleteConversation
  } = useConversations();

  const { onTouchStart, onTouchMove, onTouchEnd } = useTouch({
    onSwipeLeft: () => sidebarOpen && toggleSidebar()
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  const createNewChat = () => {
    createNewConversation();
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  // Use a consistent sidebar state for SSR
  const effectiveSidebarOpen = mounted ? sidebarOpen : false;

  // Check if we're on home page (no current conversation)
  const isOnHomePage = !currentConversationId;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Mobile Backdrop */}
      {effectiveSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden transition-opacity duration-300"
          onClick={() => toggleSidebar()}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={cn(
          "bg-white/50 dark:bg-[oklch(0.18_0.015_25)]/20 backdrop-blur-sm flex flex-col transition-all duration-300 ease-in-out h-full",
          "md:flex-shrink-0 md:shadow-none",
          effectiveSidebarOpen ? "md:w-64 md:opacity-100" : "md:w-0 md:opacity-0 md:overflow-hidden",
          "fixed md:relative z-50 md:z-auto shadow-2xl md:shadow-none",
          effectiveSidebarOpen 
            ? "w-80 opacity-100 left-0" 
            : "w-80 opacity-0 -left-80 overflow-hidden"
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 h-10 w-10 rounded-xl transition-all duration-200 hover:scale-110 group"
            >
              <Menu className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">T2Chat</h1>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={createNewChat}
              className={cn(
                "group w-full relative overflow-hidden bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12 text-rose-600 dark:text-rose-300 h-12 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 dark:shadow-rose-500/10 dark:hover:shadow-rose-500/20 transition-all duration-300 ease-out backdrop-blur-sm",
                isOnHomePage && "opacity-50 cursor-not-allowed"
              )}
              variant="ghost"
              disabled={isOnHomePage}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent dark:from-white/10 rounded-xl"></div>
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
              <span className="relative z-10 tracking-[0.5px] group-hover:tracking-wide transition-all duration-300 ease-out">New chat</span>
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black/50 dark:text-white/50" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-transparent text-base text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="h-px bg-black/10 dark:bg-white/10 mt-4"></div>
        </div>
        
        <div className="flex-1 min-h-0 px-4">
          <div className="h-full overflow-y-auto scrollbar-hide">
            <div className="space-y-1 py-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationSelect(conversation.id)}
                  className={`group px-3 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                    conversation.id === currentConversationId
                      ? "bg-rose-500/8 dark:bg-rose-300/8"
                      : "hover:bg-rose-500/5 dark:hover:bg-white/5 active:bg-rose-500/10 dark:active:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className={`text-base truncate ${
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
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Show message when no conversations exist */}
              {conversations.length === 0 && (
                <div className="text-center py-8 px-4">
                  <div className="text-black/40 dark:text-white/40 text-base">
                    No conversations yet
                  </div>
                  <div className="text-black/30 dark:text-white/30 text-sm mt-1">
                    Start a new chat to begin
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 flex-shrink-0">
          <Button
            variant="ghost"
            className="group w-full justify-start h-auto px-3 py-2 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/5 hover:from-rose-500/10 hover:to-rose-500/10 dark:hover:from-rose-300/10 dark:hover:to-rose-300/10 border border-rose-500/10 dark:border-rose-300/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 rounded-lg backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
                <div className="w-4 h-4 rounded-full bg-rose-500/30 dark:bg-rose-300/30"></div>
              </div>
              <div className="flex-1 text-center min-w-0">
                <div className="text-base font-medium text-black/80 dark:text-white/80 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
                  Sign in
                </div>
              </div>
              <div className="w-4 h-4 text-black/40 dark:text-white/40 group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors flex-shrink-0">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full md:w-auto">
        {/* Theme Switcher */}
        <div className="absolute top-3 right-3 z-10">
          <ThemeSwitcher />
        </div>

        {/* Menu and New Chat buttons for mobile/collapsed sidebar */}
        <div className={cn(
          "absolute top-3 left-3 z-30 transition-all duration-300 ease-in-out",
          effectiveSidebarOpen 
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
              className="relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-6 w-6 p-0 hover:bg-transparent"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            {/* Vertical divider */}
            <div className="relative z-10 w-px h-5 bg-rose-500/20 dark:bg-rose-300/20"></div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={createNewConversation}
              className={cn(
                "relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-6 w-6 p-0 hover:bg-transparent",
                isOnHomePage && "opacity-30 cursor-not-allowed"
              )}
              title="New conversation"
              disabled={isOnHomePage}
            >
              <Plus className="w-5 h-5" />
            </Button>
            
            {/* Premium glow effect in dark mode */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
          </div>
        </div>

        {/* Page Content */}
        {children}

        {/* Premium subtle glow effect */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
      </div>
    </div>
  );
} 