'use client'

import { Button } from '@/components/ui/button'
import { Plus, Menu, Search, Command as CommandIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatList } from './ChatList'
import { UserProfile } from './UserProfile'
import { CommandPalette } from './CommandPalette'
import { ConvexChat, UserMetadata } from '@/lib/types'
import { memo, useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import { Id } from '../../../../../convex/_generated/dataModel'

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
  editingChatId: string | null
  allChats: Array<{
    id: Id<"chats">
    title: string
    createdAt: Date
    lastMessageAt: Date
    isBranch: boolean | undefined
  }> | ConvexChat[]
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onToggleSidebar: () => void
  onSearchChange: (query: string) => void
  onNewChat: () => void
  onChatSelect: (chatId: string) => void
  onChatDelete: (chatId: string) => void
  onChatRename: (chatId: string, currentTitle: string) => void
  onChatShare: (chatId: string) => void
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
  editingChatId,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onToggleSidebar,
  onSearchChange,
  onNewChat,
  onChatSelect,
  onChatDelete,
  onChatRename,
  onChatShare,
  onSettingsClick,
  allChats = [],
}: SidebarProps) {

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value)
    },
    [onSearchChange],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchClick = () => {
    setCommandPaletteOpen(true)
  }

  const handleCommandPaletteClose = () => {
    setCommandPaletteOpen(false)
  }

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
              className="text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5.5 w-5.5 p-0 hover:bg-transparent flex items-center justify-center hover:cursor-pointer"
              title="Close sidebar"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          </div>
          <Link href="/">
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">
              T2Chat
            </h1>
          </Link>
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

            {/* Command+K Search Trigger */}
            <button
              onClick={handleSearchClick}
              className="w-full relative group cursor-pointer rounded-md overflow-hidden"
            >
              {/* Chat history style hover effect */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
              </div>

              <div className="relative flex items-center">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/50 dark:text-white/50 transition-colors" />
                <div className="w-full pl-10 pr-16 py-1.5 bg-transparent text-sm text-black/50 dark:text-white/50 border border-transparent rounded-md transition-colors whitespace-nowrap truncate">
                  Search chats...
                </div>
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 hidden md:flex items-center gap-1 text-xs text-black/40 dark:text-white/40 transition-colors">
                  <CommandIcon className="w-3 h-3" />
                  <span>K</span>
                </div>
              </div>
            </button>
          </div>

          {/* <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/50 dark:text-white/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-3 py-1.5 bg-transparent text-sm text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none"
            />
          </div>
        </div> */}

        <div className="h-px bg-black/10 dark:bg-white/10 mt-4"></div>
      </div>

      <ChatList
        groupedChats={groupedChats}
        currentChatId={currentChatId}
        totalChats={totalChats}
        editingChatId={editingChatId}
        isSignedIn={isSignedIn}
        onChatSelect={onChatSelect}
        onChatDelete={onChatDelete}
        onChatRename={onChatRename}
        onChatShare={onChatShare}
      />

      <UserProfile isSignedIn={isSignedIn} userMetadata={userMetadata} onSettingsClick={onSettingsClick} />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={handleCommandPaletteClose}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        groupedChats={groupedChats}
        allChats={allChats}
        onNewChat={onNewChat}
        onChatSelect={onChatSelect}
        effectiveSidebarOpen={effectiveSidebarOpen}
        onCloseSidebar={onToggleSidebar}
        isOnHomePage={isOnHomePage}
      />
    </div>
  )
})
