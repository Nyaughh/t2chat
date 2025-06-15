'use client'

import { memo } from 'react'
import { X, Edit, Share2, GitFork } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContextMenu, Menu, Item, Separator } from 'react-contexify'

const MENU_ID = 'chat-item-menu';

interface ChatItemProps {
  chat: {
    id: string
    title: string
    isBranch?: boolean
  }
  currentChatId: string | null
  totalChats: number
  onSelect: (chatId: string) => void
  onDelete: (chatId: string) => void
  onRename: (chatId: string, currentTitle: string) => void
  onShare: (chatId: string) => void
}

export const ChatItem = memo(function ChatItem({ chat, currentChatId, totalChats, onSelect, onDelete, onRename, onShare }: ChatItemProps) {
  const isActive = chat.id === currentChatId
  const { show } = useContextMenu({
    id: MENU_ID,
  });

  return (
    <>
      <div
        onClick={() => onSelect(chat.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          show({ event: e });
        }}
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
            {chat.isBranch && <GitFork className="w-3 h-3 flex-shrink-0" />}
            <div className="text-sm truncate">{chat.title}</div>
          </div>
          {totalChats > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(chat.id)
              }}
              className="opacity-0 group-hover:opacity-100 p-1 -m-1 text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-all duration-150 ease-[0.25,1,0.5,1]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <Menu id={MENU_ID} theme="dark" className="bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 rounded-lg shadow-lg">
        <Item onClick={() => onRename(chat.id, chat.title)} className="text-black/70 dark:text-white/70 hover:bg-rose-500/10">
            <Edit className="w-4 h-4 mr-2" />
            Rename
        </Item>
        <Item onClick={() => onShare(chat.id)} className="text-black/70 dark:text-white/70 hover:bg-rose-500/10">
            <Share2 className="w-4 h-4 mr-2" />
            Share
        </Item>
        <Separator />
        <Item onClick={() => onDelete(chat.id)} className="text-red-500 hover:bg-red-500/10">
            <X className="w-4 h-4 mr-2" />
            Delete
        </Item>
      </Menu>
    </>
  )
}) 