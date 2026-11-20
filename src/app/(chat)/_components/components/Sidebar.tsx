'use client'

import { Button } from '@/components/ui/button'
import { Plus, Menu, Search, Command as CommandIcon } from 'lucide-react'
import { ItemHighlight } from '@/components/ui/item-highlight'
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
        'bg-sidebar md:bg-sidebar/60 dark:md:bg-sidebar/20 backdrop-blur-sm flex flex-col transition-all duration-200 ease-[0.23,1,0.32,1] h-full',
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
        {/* Header: the menu button sits exactly where the collapsed-sidebar control cluster renders */}
        <div className="flex items-center gap-1.5 mb-4">
          <div className="rounded-lg border border-transparent p-1">
            <button onClick={onToggleSidebar} className="control-button" title="Close sidebar" aria-label="Close sidebar">
              <Menu />
            </button>
          </div>
          <Link href="/" className="rounded-md">
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">
              T2Chat
            </h1>
          </Link>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onNewChat}
            className={cn(
              'group w-full h-10 rounded-xl text-sm font-semibold',
              'bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12',
              'text-rose-600 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-300',
              'hover:from-rose-500/18 hover:to-rose-500/18 dark:hover:from-rose-300/18 dark:hover:to-rose-300/18',
              'shadow-sm shadow-rose-500/10 hover:shadow-md hover:shadow-rose-500/15 dark:shadow-black/20',
              'transition-all duration-200 ease-[0.25,1,0.5,1]',
            )}
            variant="ghost"
            disabled={isOnHomePage}
          >
            <Plus className="group-hover:rotate-90 transition-transform duration-200 ease-[0.25,1,0.5,1]" />
            <span>New chat</span>
          </Button>

          {/* Command+K Search Trigger */}
          <button
            onClick={handleSearchClick}
            className="w-full relative group cursor-pointer overflow-hidden text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
          >
            <ItemHighlight />
            <div className="relative z-10 flex items-center gap-2.5 px-3 py-2 text-sm">
              <Search className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">Search chats...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
                <CommandIcon className="size-2.5" />K
              </kbd>
            </div>
          </button>
        </div>

        <div className="h-px bg-border mt-4"></div>
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
