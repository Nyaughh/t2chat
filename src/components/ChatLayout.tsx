'use client'

import { Button } from '@/components/ui/button'
import { Plus, Menu, Search, X, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import SettingsPage from '@/components/SettingsPage'
import { useSidebar } from '@/hooks/useSidebar'
import { useConversations } from '@/hooks/useConversations'
import { useTouch } from '@/hooks/useTouch'
import { useState, useEffect } from 'react'
import { UserMetadata } from '@/lib/types'
import { signInWithDiscord } from '@/lib/auth'
import { signIn } from '@/lib/auth-client'

interface ChatLayoutProps {
  children: React.ReactNode
  isSignedIn: boolean
  userMetadata: UserMetadata
}

export default function ChatLayout({ children, userMetadata, isSignedIn }: ChatLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { sidebarOpen, toggleSidebar } = useSidebar()
  const {
    conversations,
    currentConversationId,
    searchQuery,
    filteredConversations,
    createNewConversation,
    setCurrentConversationId,
    setSearchQuery,
    deleteConversation,
  } = useConversations()

  const { onTouchStart, onTouchMove, onTouchEnd } = useTouch({
    onSwipeLeft: () => sidebarOpen && toggleSidebar(),
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleSidebar()
    }
  }

  const createNewChat = () => {
    createNewConversation()
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleSidebar()
    }
  }
  // Use a consistent sidebar state for SSR
  const effectiveSidebarOpen = mounted ? sidebarOpen : false
  // Check if we're on home page (no current conversation)
  const isOnHomePage = !currentConversationId
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
          'bg-white/50 dark:bg-[oklch(0.18_0.015_25)]/20 backdrop-blur-sm flex flex-col transition-all duration-300 ease-in-out h-full',
          'md:flex-shrink-0 md:shadow-none',
          effectiveSidebarOpen ? 'md:w-60 md:opacity-100' : 'md:w-0 md:opacity-0 md:overflow-hidden',
          'fixed md:relative z-50 md:z-auto shadow-2xl md:shadow-none',
          effectiveSidebarOpen ? 'w-80 opacity-100 left-0' : 'w-80 opacity-0 -left-80 overflow-hidden',
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
              className="text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 h-9 w-9 rounded-xl transition-all duration-200 hover:scale-110 group"
            >
              <Menu className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            </Button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">
              T2Chat
            </h1>
          </div>

          <div className="space-y-2">
            <Button
              onClick={createNewChat}
              className={cn(
                'group w-full relative overflow-hidden bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12 text-rose-600 dark:text-rose-300 h-10 text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 dark:shadow-rose-500/10 dark:hover:shadow-rose-500/20 transition-all duration-300 ease-out backdrop-blur-sm',
                isOnHomePage && 'opacity-50 cursor-not-allowed',
              )}
              variant="ghost"
              disabled={isOnHomePage}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent dark:from-white/10 rounded-xl"></div>
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
              <span className="relative z-10 tracking-[0.5px] group-hover:tracking-wide transition-all duration-300 ease-out">
                New chat
              </span>
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/50 dark:text-white/50" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-1.5 bg-transparent text-sm text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none"
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
                  className={cn(
                    'group px-3 py-2.5 cursor-pointer transition-all duration-200 relative overflow-hidden',
                    conversation.id === currentConversationId
                      ? 'text-rose-600 dark:text-rose-300'
                      : 'hover:text-rose-600 dark:hover:text-rose-300 text-black/70 dark:text-white/70',
                  )}
                >
                  {/* Premium background for active state */}
                  {conversation.id === currentConversationId && (
                    <>
                      {/* Main gradient background with sharp edges */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>

                      {/* Top shadow lighting */}
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                      {/* Bottom shadow lighting */}
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                      {/* Premium inner glow */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
                    </>
                  )}

                  {/* Hover effect for non-active items */}
                  {conversation.id !== currentConversationId && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/3 dark:via-rose-300/3 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                  )}

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{conversation.title}</div>
                    </div>
                    {conversations.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConversation(conversation.id)
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
                  <div className="text-black/40 dark:text-white/40 text-sm">No conversations yet</div>
                  <div className="text-black/30 dark:text-white/30 text-xs mt-1">Start a new chat to begin</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 flex-shrink-0">
          {isSignedIn && (
            <div
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm"
            >
              {userMetadata.image ? (
                <img
                  src={userMetadata.image}
                  alt="User profile"
                  className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
                  <div className="text-rose-600 dark:text-rose-300 font-medium text-sm">
                    {userMetadata.name?.[0] || userMetadata.email || '?'}
                  </div>
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <div className="text-sm font-medium truncate">
                  {userMetadata.name
                    ? `${userMetadata.name}`
                    : userMetadata.email}
                </div>
                {userMetadata.email && (
                  <div className="text-xs text-muted-foreground truncate">{userMetadata.email}</div>
                )}
              </div>
            </div>
          )}
          {!isSignedIn && (
              <Button
                onClick={() => signIn.social({
                  provider: 'discord',
                })}
                variant="ghost"
                className="group w-full justify-start h-auto px-2.5 py-1.5 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/5 hover:from-rose-500/10 hover:to-rose-500/10 dark:hover:from-rose-300/10 dark:hover:to-rose-300/10 border border-rose-500/10 dark:border-rose-300/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 rounded-lg backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 w-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="sign-in"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="flex items-center gap-3 w-full"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 rounded-full bg-rose-500/30 dark:bg-rose-300/30"></div>
                      </div>
                      <div className="flex-1 text-center min-w-0">
                        <div className="text-sm font-medium text-black/80 dark:text-white/80 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
                          Sign in
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <div className="w-4 h-4 text-black/40 dark:text-white/40 group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors flex-shrink-0">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full md:w-auto">
        {/* Settings & Theme Switcher */}
        <div className="absolute top-3 right-3 z-10">
          <AnimatePresence>
            {!effectiveSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="group relative p-2.5 rounded-xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 ease-out shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20 hover:shadow-xl hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10 flex items-center gap-2"
              >
                {/* Gradient overlays for premium look */}
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-xl"></div>

                <button
                  className="relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-6 w-6 p-0 hover:bg-transparent"
                  title="Settings"
                >
                  <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                </button>

                {/* Vertical divider */}
                <div className="relative z-10 w-px h-5 bg-rose-500/20 dark:bg-rose-300/20"></div>

                <ThemeSwitcher />

                {/* Premium glow effect in dark mode */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Menu and New Chat buttons for mobile/collapsed sidebar */}
        <div
          className={cn(
            'absolute top-3 left-3 z-30 transition-all duration-300 ease-in-out',
            effectiveSidebarOpen ? 'md:opacity-0' : 'opacity-100',
          )}
        >
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
                'relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-6 w-6 p-0 hover:bg-transparent',
                isOnHomePage && 'opacity-30 cursor-not-allowed',
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

      {/* Settings Page */}
      {userMetadata.email && <SettingsPage isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} user={{
        name: userMetadata.name || '',
        email: userMetadata.email || '',
        image: userMetadata.image || '',
      }} />}
    </div>
  )
}
