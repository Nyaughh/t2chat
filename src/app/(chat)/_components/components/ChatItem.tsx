'use client'

import { memo, useState } from 'react'
import { Edit, Share2, GitFork, MoreVertical, Trash2 } from 'lucide-react'
import { ItemHighlight } from '@/components/ui/item-highlight'
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => onSelect(chat.id)}
          className={cn(
            'group relative cursor-pointer overflow-hidden px-3 py-2 transition-colors duration-150 ease-[0.25,1,0.5,1]',
            isActive
              ? 'text-rose-600 dark:text-rose-300'
              : 'text-foreground/70 hover:text-rose-600 dark:hover:text-rose-300',
          )}
        >
          <ItemHighlight active={isActive} />

          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {chat.isBranch && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GitFork className="size-3.5 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Branched conversation</TooltipContent>
                </Tooltip>
              )}
              <div className="text-sm truncate">{chat.title}</div>
            </div>
            {/* More options dropdown - visible on mobile, hover on desktop */}
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      aria-label="More options"
                      className={cn(
                        'flex size-6 -my-1 -mr-1 flex-shrink-0 items-center justify-center rounded-md cursor-pointer transition-all duration-150 ease-[0.25,1,0.5,1]',
                        'text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-300 dark:hover:bg-rose-300/10',
                        'opacity-100 md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100',
                      )}
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">More options</TooltipContent>
              </Tooltip>

              <DropdownMenuContent side="right" align="start" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onRename(chat.id, chat.title)
                    setDropdownOpen(false)
                  }}
                >
                  <Edit />
                  <span>Rename</span>
                </DropdownMenuItem>

                {isSignedIn && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onShare(chat.id)
                      setDropdownOpen(false)
                    }}
                  >
                    <Share2 />
                    <span>Share</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(chat.id)
                    setDropdownOpen(false)
                  }}
                >
                  <Trash2 />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="min-w-[180px]">
        <ContextMenuItem onClick={() => onRename(chat.id, chat.title)}>
          <Edit />
          <span>Rename</span>
        </ContextMenuItem>

        {isSignedIn && (
          <ContextMenuItem onClick={() => onShare(chat.id)}>
            <Share2 />
            <span>Share</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" onClick={() => onDelete(chat.id)}>
          <Trash2 />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
