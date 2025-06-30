'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Command as CommandIcon, MessageSquare, Clock } from 'lucide-react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { Id } from '../../../../../convex/_generated/dataModel'
import { ConvexChat } from '@/lib/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  groupedChats: Array<{
    title: string
    chats: Array<{ id: string; title: string }>
  }>
  allChats: Array<{
    id: Id<"chats">
    title: string
    createdAt: Date
    lastMessageAt: Date
    isBranch: boolean | undefined
  }> | ConvexChat[]
  onNewChat: () => void
  onChatSelect: (chatId: string) => void
  effectiveSidebarOpen?: boolean
  onCloseSidebar?: () => void
  isOnHomePage?: boolean
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  if (diffInHours < 24) return `${diffInHours}h ago`
  if (diffInDays < 7) return `${diffInDays}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CommandPalette({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  groupedChats,
  allChats,
  onNewChat,
  onChatSelect,
  effectiveSidebarOpen,
  onCloseSidebar,
  isOnHomePage = false,
}: CommandPaletteProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen && effectiveSidebarOpen && onCloseSidebar) {
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        onCloseSidebar()
      }
    }
  }, [isOpen, effectiveSidebarOpen, onCloseSidebar])

  useEffect(() => {
    if (isOpen) {
      setInternalSearchQuery(searchQuery)
    }
  }, [isOpen, searchQuery])

  const recentChats = useMemo(() => {
    if (!groupedChats || groupedChats.length === 0) return []
    
    const allGroupedChats = groupedChats.flatMap(group => group.chats)
    
    return allGroupedChats
      .slice(0, 5)
      .map(chat => {
        const fullChat = allChats.find(c => {
          const chatId = 'id' in c ? c.id : (c as any)._id
          const chatTitle = c.title
          return chatTitle === chat.title || chatId === chat.id
        })
        
        let timestamp = new Date()
        if (fullChat) {
          const chat = fullChat as any
          if (chat.lastMessageAt) {
            timestamp = chat.lastMessageAt instanceof Date ? chat.lastMessageAt : new Date(chat.lastMessageAt)
          } else if (chat.updatedAt) {
            timestamp = chat.updatedAt instanceof Date ? chat.updatedAt : new Date(chat.updatedAt)
          } else if (chat.createdAt) {
            timestamp = chat.createdAt instanceof Date ? chat.createdAt : new Date(chat.createdAt)
          }
        }
        
        return {
          id: chat.id,
          title: chat.title,
          timestamp,
        }
      })
  }, [groupedChats, allChats])

  const searchResults = useMemo(() => {
    if (!internalSearchQuery.trim()) return []
    
    return groupedChats
      .flatMap(group => group.chats)
      .slice(0, 8)
      .map(chat => {
        const fullChat = allChats.find(c => {
          const chatId = 'id' in c ? c.id : (c as any)._id
          const chatTitle = c.title
          return chatTitle === chat.title || chatId === chat.id
        })
        
        let timestamp = new Date()
        if (fullChat) {
          const chat = fullChat as any
          if (chat.lastMessageAt) {
            timestamp = chat.lastMessageAt instanceof Date ? chat.lastMessageAt : new Date(chat.lastMessageAt)
          } else if (chat.updatedAt) {
            timestamp = chat.updatedAt instanceof Date ? chat.updatedAt : new Date(chat.updatedAt)
          } else if (chat.createdAt) {
            timestamp = chat.createdAt instanceof Date ? chat.createdAt : new Date(chat.createdAt)
          }
        }
        
        return {
          ...chat,
          timestamp,
        }
      })
  }, [groupedChats, internalSearchQuery, allChats])

  const handleNewChat = () => {
    if (!isOnHomePage) {
      onNewChat()
      onClose()
    }
  }

  const handleChatSelect = (chatId: string) => {
    onChatSelect(chatId)
    onClose()
  }

  const handleClose = () => {
    setInternalSearchQuery('')
    onSearchChange('')
    onClose()
  }

  const handleSearchChange = (value: string) => {
    setInternalSearchQuery(value)
    onSearchChange(value)
  }

  return (
    <CommandDialog 
      open={isOpen} 
      onOpenChange={handleClose}
      className="max-w-3xl w-[90vw] md:w-[600px]"
    >
      <div className="flex items-center border-b px-3 w-full gap-2 overflow-hidden">
  <CommandIcon className="h-4 w-4 shrink-0 opacity-50" />

  <div className="flex-1 min-w-0">
    <CommandInput
      placeholder="Search conversations..."
      value={internalSearchQuery}
      onValueChange={handleSearchChange}
      className="h-12 w-full bg-transparent py-3 text-sm truncate outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-none focus:ring-0 focus-visible:ring-0"
    />
  </div>
</div>

      <CommandList 
        className="max-h-[400px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(244 63 94 / 0.3) transparent' }}
      >
        <CommandEmpty>
          {internalSearchQuery.trim() ? 'No conversations found.' : 'Start typing to search...'}
        </CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={handleNewChat}
            disabled={isOnHomePage}
            className={cn(
              "group relative overflow-hidden px-4 py-3 w-full data-[selected=true]:bg-transparent dark:data-[selected=true]:bg-transparent",
              isOnHomePage
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:text-rose-600 dark:hover:text-rose-300"
            )}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                isOnHomePage 
                  ? "bg-rose-500/5 dark:bg-rose-300/5" 
                  : "bg-rose-500/10 dark:bg-rose-300/10"
              )}>
                <Plus className={cn(
                  "h-4 w-4",
                  isOnHomePage 
                    ? "text-rose-600/50 dark:text-rose-300/50" 
                    : "text-rose-600 dark:text-rose-300"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">New Chat</div>
                <div className="text-xs text-muted-foreground">
                  {isOnHomePage ? 'Already on home page' : 'Start a new conversation'}
                </div>
              </div>
            </div>
          </CommandItem>
        </CommandGroup>

        {!internalSearchQuery.trim() && recentChats.length > 0 && (
          <CommandGroup heading="Recent Chats">
            {recentChats.map((chat) => (
              <CommandItem
                key={chat.id}
                onSelect={() => handleChatSelect(chat.id)}
                className="group relative overflow-hidden px-4 py-3 w-full cursor-pointer data-[selected=true]:bg-transparent dark:data-[selected=true]:bg-transparent hover:text-rose-600 dark:hover:text-rose-300"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
                </div>
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-300/10 flex-shrink-0">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{chat.title}</div>
                    <div className="text-xs text-muted-foreground">Recent conversation</div>
                  </div>
                  <div className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                    {formatRelativeTime(chat.timestamp)}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {internalSearchQuery.trim() && searchResults.length > 0 && (
          <CommandGroup heading="Search Results">
            {searchResults.map((chat) => (
              <CommandItem
                key={chat.id}
                onSelect={() => handleChatSelect(chat.id)}
                className="group relative overflow-hidden px-4 py-3 w-full cursor-pointer data-[selected=true]:bg-transparent dark:data-[selected=true]:bg-transparent hover:text-rose-600 dark:hover:text-rose-300"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
                </div>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-300/10 flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-300" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{chat.title}</div>
                      <div className="text-xs text-muted-foreground">Search result</div>
                    </div>
                    <div className="text-xs text-muted-foreground ml-3 flex-shrink-0">
                      {formatRelativeTime(chat.timestamp)}
                    </div>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!internalSearchQuery.trim() && recentChats.length === 0 && (
          <CommandGroup heading="Getting Started">
            <div className="px-4 py-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to get going!</p>
            </div>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}