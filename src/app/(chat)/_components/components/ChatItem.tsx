'use client'

import { memo, useState } from 'react'
import { X, Edit, Share2, GitFork, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatItemProps {
  chat: {
    id: string
    title: string
    isBranch?: boolean
  }
  currentChatId: string | null
  totalChats: number
  isSignedIn: boolean
  onSelect: (chatId: string) => void
  onDelete: (chatId: string) => void
  onRename: (chatId: string, currentTitle: string) => void
  onShare: (chatId: string) => void
}

export const ChatItem = memo(function ChatItem({
  chat,
  currentChatId,
  totalChats,
  isSignedIn,
  onSelect,
  onDelete,
  onRename,
  onShare,
}: ChatItemProps) {
  const isActive = chat.id === currentChatId
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={() => onSelect(chat.id)}
            className={cn(
              'group px-3 py-2.5 cursor-pointer transition-all duration-150 ease-[0.25,1,0.5,1] relative overflow-hidden',
              isActive
                ? 'text-rose-600 dark:text-rose-300'
                : 'hover:text-rose-600 dark:hover:text-rose-300 text-black/70 dark:text-white/70',
            )}
          >
            {/* Premium background for active state */}
            {isActive && (
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
            {!isActive && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
                {/* Main gradient background with sharp edges */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>

                {/* Top shadow lighting */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                {/* Bottom shadow lighting */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                {/* Premium inner glow */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
              </div>
            )}

            <div className="flex items-center justify-between relative z-10">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {chat.isBranch && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GitFork className="w-3 h-3 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right">Branched conversation</TooltipContent>
                  </Tooltip>
                )}
                <div className="text-sm truncate">{chat.title}</div>
              </div>
              <div className="flex items-center gap-1">
                {/* More options dropdown - visible on mobile, hover on desktop */}
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 -m-1 text-black/40 dark:text-white/40 hover:text-rose-500 dark:hover:text-rose-400  hover:cursor-pointer transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110 outline-none focus:outline-none"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">More options</TooltipContent>
                  </Tooltip>

                  <DropdownMenuContent
                    side="right"
                    align="start"
                    className={cn(
                      // Glass morphism background
                      'bg-white/90 dark:bg-[oklch(0.15_0.015_25)]/90 backdrop-blur-2xl',
                      // Border and shadow
                      'border border-rose-500/20 dark:border-rose-300/20 shadow-2xl shadow-rose-500/10 dark:shadow-black/50',
                      // Rounded corners
                      'rounded-2xl',
                      // Padding and sizing
                      'p-2 min-w-[180px]',
                      // Premium effects
                      'relative overflow-hidden',
                    )}
                  >
                    {/* Premium gradient overlays */}
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/15 pointer-events-none rounded-2xl" />
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 dark:to-white/5 pointer-events-none rounded-2xl" />

                    <div className="relative z-10 space-y-1">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onRename(chat.id, chat.title)
                          setDropdownOpen(false)
                        }}
                        className={cn(
                          'text-black/80 dark:text-white/80 hover:text-rose-600 dark:hover:text-rose-300',
                          'hover:bg-rose-500/10 dark:hover:bg-rose-300/10',
                          'focus:bg-rose-500/10 dark:focus:bg-rose-300/10',
                          'focus:text-rose-600 dark:focus:text-rose-300',
                          'transition-all duration-150 cursor-pointer',
                          'px-3 py-2.5 text-sm font-medium flex items-center gap-3',
                          'rounded-xl outline-none ring-0 border-0',
                          // Remove any focus rings or blue colors
                          'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
                        )}
                      >
                        <Edit className="w-4 h-4" />
                        <span>Rename</span>
                      </DropdownMenuItem>

                      {isSignedIn && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onShare(chat.id)
                            setDropdownOpen(false)
                          }}
                          className={cn(
                            'text-black/80 dark:text-white/80 hover:text-rose-600 dark:hover:text-rose-300',
                            'hover:bg-rose-500/10 dark:hover:bg-rose-300/10',
                            'focus:bg-rose-500/10 dark:focus:bg-rose-300/10',
                            'focus:text-rose-600 dark:focus:text-rose-300',
                            'transition-all duration-150 cursor-pointer',
                            'px-3 py-2.5 text-sm font-medium flex items-center gap-3',
                            'rounded-xl outline-none ring-0 border-0',
                            // Remove any focus rings or blue colors
                            'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
                          )}
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Share</span>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="my-2 mx-2 h-px bg-gradient-to-r from-transparent via-rose-500/20 dark:via-rose-300/20 to-transparent border-0" />

                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(chat.id)
                          setDropdownOpen(false)
                        }}
                        className={cn(
                          'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300',
                          'hover:bg-red-500/10 dark:hover:bg-red-400/10',
                          'focus:bg-red-500/10 dark:focus:bg-red-400/10',
                          'focus:text-red-600 dark:focus:text-red-300',
                          'transition-all duration-150 cursor-pointer',
                          'px-3 py-2.5 text-sm font-medium flex items-center gap-3',
                          'rounded-xl outline-none ring-0 border-0',
                          // Remove any focus rings or blue colors
                          'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
                        )}
                      >
                        <X className="w-4 h-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </div>

                    {/* Premium glow effect */}
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/15 to-rose-300/0 rounded-2xl blur-2xl opacity-0 dark:opacity-30 pointer-events-none" />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent
          className={cn(
            // Glass morphism background
            'bg-white/90 dark:bg-[oklch(0.15_0.015_25)]/90 backdrop-blur-2xl',
            // Border and shadow
            'border border-rose-500/20 dark:border-rose-300/20 shadow-2xl shadow-rose-500/10 dark:shadow-black/50',
            // Rounded corners
            'rounded-2xl',
            // Padding and sizing
            'p-2 min-w-[200px]',
            // Animation override
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            // Premium effects
            'relative overflow-hidden',
          )}
        >
          {/* Premium gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/15 pointer-events-none rounded-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 dark:to-white/5 pointer-events-none rounded-2xl" />

          <div className="relative z-10 space-y-1">
            <ContextMenuItem
              onClick={() => onRename(chat.id, chat.title)}
              className={cn(
                'text-black/80 dark:text-white/80 hover:text-rose-600 dark:hover:text-rose-300',
                'hover:bg-rose-500/10 dark:hover:bg-rose-300/10',
                'focus:bg-rose-500/10 dark:focus:bg-rose-300/10',
                'focus:text-rose-600 dark:focus:text-rose-300',
                'transition-all duration-150 cursor-pointer',
                'px-3 py-2.5 text-sm font-medium flex items-center gap-3',
                'rounded-xl outline-none ring-0 border-0',
                // Remove any focus rings or blue colors
                'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
              )}
            >
              <Edit className="w-4 h-4" />
              <span>Rename</span>
            </ContextMenuItem>

            {isSignedIn && (
              <ContextMenuItem
                onClick={() => onShare(chat.id)}
                className={cn(
                  'text-black/80 dark:text-white/80 hover:text-rose-600 dark:hover:text-rose-300',
                  'hover:bg-rose-500/10 dark:hover:bg-rose-300/10',
                  'focus:bg-rose-500/10 dark:focus:bg-rose-300/10',
                  'focus:text-rose-600 dark:focus:text-rose-300',
                  'transition-all duration-150 cursor-pointer',
                  'px-3 py-2.5 text-sm font-medium flex items-center gap-3',
                  'rounded-xl outline-none ring-0 border-0',
                  // Remove any focus rings or blue colors
                  'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
                )}
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </ContextMenuItem>
            )}

            <ContextMenuSeparator className="my-2 mx-2 h-px bg-gradient-to-r from-transparent via-rose-500/20 dark:via-rose-300/20 to-transparent border-0" />

            <ContextMenuItem
              onClick={() => onDelete(chat.id)}
              className={cn(
                'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300',
                'hover:bg-red-500/10 dark:hover:bg-red-400/10',
                'focus:bg-red-500/10 dark:focus:bg-red-400/10',
                'focus:text-red-600 dark:focus:text-red-300',
                'transition-all duration-150 cursor-pointer',
                'px-3 py-2.5 text-sm font-medium flex items-center gap-3',
                'rounded-xl outline-none ring-0 border-0',
                // Remove any focus rings or blue colors
                'focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0',
              )}
            >
              <X className="w-4 h-4" />
              <span>Delete</span>
            </ContextMenuItem>
          </div>

          {/* Premium glow effect */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/15 to-rose-300/0 rounded-2xl blur-2xl opacity-0 dark:opacity-30 pointer-events-none" />
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
})
