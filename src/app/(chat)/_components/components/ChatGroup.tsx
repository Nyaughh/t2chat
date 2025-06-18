'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { ChatItem } from './ChatItem'
import { ConvexChat } from '@/lib/types'

interface ChatGroupProps {
  title: string
  chats: Array<{ id: string; title: string; isBranch?: boolean }>
  currentChatId: string | null
  totalChats: number
  editingChatId: string | null
  isFirst?: boolean
  onChatSelect: (chatId: string) => void
  onChatDelete: (chatId: string) => void
  onChatRename: (chatId: string, currentTitle: string) => void
  onChatShare: (chatId: string) => void
}

export const ChatGroup = memo(function ChatGroup({
  title,
  chats,
  currentChatId,
  totalChats,
  editingChatId,
  isFirst = false,
  onChatSelect,
  onChatDelete,
  onChatRename,
  onChatShare,
}: ChatGroupProps) {
  return (
    <div className={cn('mb-4', isFirst && 'mt-0')}>
      {/* Group header */}
      <div className="px-3 py-1.5 mb-2">
        <h3 className="text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wider">{title}</h3>
      </div>

      {/* Group chats */}
      <div className="space-y-1">
        {chats.map((chat) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            currentChatId={currentChatId}
            totalChats={totalChats}
            onSelect={onChatSelect}
            onDelete={onChatDelete}
            onRename={onChatRename}
            onShare={onChatShare}
          />
        ))}
      </div>
    </div>
  )
})
