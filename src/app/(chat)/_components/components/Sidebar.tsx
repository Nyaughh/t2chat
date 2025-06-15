'use client'

import { Button } from '@/components/ui/button'
import { Plus, Menu, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatList } from './ChatList'
import { UserProfile } from './UserProfile'
import { UserMetadata } from '@/lib/types'
import { memo, useCallback } from 'react'

interface SidebarProps {
  effectiveSidebarOpen: boolean
  isOnHomePage: boolean
  searchQuery: string
  groupedChats: Array<{
    title: string
    chats: Array<{ id: string; title: string }>
  }>
  currentChatId: string | null
  totalChats: number
  isSignedIn: boolean
  userMetadata: UserMetadata
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onToggleSidebar: () => void
  onSearchChange: (query: string) => void
  onNewChat: () => void
  onChatSelect: (chatId: string) => void
  onChatDelete: (chatId: string) => void
  onSettingsClick: () => void
}

export const Sidebar = memo(function Sidebar({
  effectiveSidebarOpen,
  isOnHomePage,
  searchQuery,
  groupedChats,
  currentChatId,
  totalChats,
  isSignedIn,
  userMetadata,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onToggleSidebar,
  onSearchChange,
  onNewChat,
  onChatSelect,
  onChatDelete,
  onSettingsClick,
}: SidebarProps) {
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value)
  }, [onSearchChange])

  return (
    <div
      className={cn(
        'bg-white/50 dark:bg-[oklch(0.18_0.015_25)]/20 backdrop-blur-sm flex flex-col transition-all duration-200 ease-[0.23,1,0.32,1] h-full',
        'md:flex-shrink-0 md:shadow-none',
        effectiveSidebarOpen ? 'md:w-60 md:opacity-100' : 'md:w-0 md:opacity-0 md:overflow-hidden',
        'fixed md:relative z-50 md:z-auto shadow-2xl md:shadow-none',
        effectiveSidebarOpen ? 'w-80 opacity-100 left-0' : 'w-80 opacity-0 -left-80 overflow-hidden',
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="pt-2.5 pl-2.5 pr-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg">
            <button
              onClick={onToggleSidebar}
              className="text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5.5 w-5.5 p-0 hover:bg-transparent flex items-center justify-center"
              title="Close sidebar"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">
            T2Chat
          </h1>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onNewChat}
            className={cn(
              'group w-full relative overflow-hidden bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12 text-rose-600 dark:text-rose-300 h-10 text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 dark:shadow-rose-500/10 dark:hover:shadow-rose-500/20 transition-all duration-200 ease-[0.25,1,0.5,1] backdrop-blur-sm',
              isOnHomePage && 'opacity-50 cursor-not-allowed',
            )}
            variant="ghost"
            disabled={isOnHomePage}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent dark:from-white/10 rounded-xl"></div>
            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200 ease-[0.25,1,0.5,1]" />
            <span className="relative z-10 tracking-[0.5px] group-hover:tracking-wide transition-all duration-200 ease-[0.25,1,0.5,1]">
              New chat
            </span>
          </Button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/50 dark:text-white/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-3 py-1.5 bg-transparent text-sm text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="h-px bg-black/10 dark:bg-white/10 mt-4"></div>
      </div>

      <ChatList
        groupedChats={groupedChats}
        currentChatId={currentChatId}
        totalChats={totalChats}
        onChatSelect={onChatSelect}
        onChatDelete={onChatDelete}
      />

      <UserProfile
        isSignedIn={isSignedIn}
        userMetadata={userMetadata}
        onSettingsClick={onSettingsClick}
      />
    </div>
  )
}) 