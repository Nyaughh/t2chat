'use client'

import { Button } from '@/components/ui/button'
import { Plus, ChevronsLeft, Search, Command as CommandIcon } from 'lucide-react'
import { ItemHighlight } from '@/components/ui/item-highlight'
import { cn } from '@/lib/utils'
import { ChatList } from './ChatList'
import { UserProfile } from './UserProfile'
import { CommandPalette } from './CommandPalette'
import { ConvexChat, UserMetadata } from '@/lib/types'
import { memo, useCallback, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSettingsDialog } from '@/components/settings/SettingsDialogProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  allChats = [],
}: SidebarProps) {

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  // Read through a ref so the global shortcut listener isn't re-registered on every toggle
  const { isOpen: settingsOpen } = useSettingsDialog()
  const settingsOpenRef = useRef(settingsOpen)
  useEffect(() => {
    settingsOpenRef.current = settingsOpen
  }, [settingsOpen])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value)
    },
    [onSearchChange],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Not while Settings is open: the palette would open over the dialog, steal focus
      // from the form being edited and allow navigating away mid-edit.
      if (settingsOpenRef.current) return
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
        // Mobile: an overlay sheet. Desktop: transparent, it sits on the window frame (bg-sidebar on ChatLayout)
        'bg-sidebar md:bg-transparent flex flex-col transition-all duration-200 ease-[0.23,1,0.32,1] h-full',
        'md:flex-shrink-0 md:shadow-none',
        effectiveSidebarOpen ? 'md:w-60 md:opacity-100' : 'md:w-0 md:opacity-0 md:overflow-hidden',
        'fixed md:relative z-50 md:z-auto shadow-2xl md:shadow-none',
        effectiveSidebarOpen ? 'w-80 opacity-100 left-0' : 'w-80 opacity-0 -left-80 overflow-hidden',
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="pt-2.5 pl-2.5 pr-2 pb-2 flex-shrink-0">
        {/* Header: logo, then the « collapse control */}
        <div className="flex items-center justify-between gap-1.5 mb-3 pl-2.5 pr-0.5 h-10">
          <Link href="/" className="rounded-md">
            <h1 className="text-lg font-semibold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent tracking-tight leading-none">
              T2Chat
            </h1>
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onToggleSidebar} className="control-button" aria-label="Collapse sidebar">
                <ChevronsLeft />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-0.5 px-0.5">
          <Button
            onClick={onNewChat}
            className="group w-full h-9 justify-start gap-2.5 rounded-lg px-3 text-sm font-medium"
            variant="default"
            disabled={isOnHomePage}
          >
            <Plus className="transition-transform duration-200 ease-[0.25,1,0.5,1] group-hover:rotate-90" />
            <span>New chat</span>
          </Button>

          {/* Command+K Search Trigger */}
          <button
            onClick={handleSearchClick}
            className="w-full relative group cursor-pointer overflow-hidden text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
          >
            <ItemHighlight />
            <div className="relative z-10 flex h-9 items-center gap-2.5 px-3 text-sm">
              <Search className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">Search chats...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 font-sans text-[11px] text-muted-foreground/70">
                <CommandIcon className="size-2.5" />K
              </kbd>
            </div>
          </button>
        </div>
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

      <UserProfile isSignedIn={isSignedIn} userMetadata={userMetadata} />
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
