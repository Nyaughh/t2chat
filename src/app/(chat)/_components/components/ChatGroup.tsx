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
  isSignedIn: boolean
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
  isSignedIn,
  onChatSelect,
  onChatDelete,
  onChatRename,
  onChatShare,
}: ChatGroupProps) {
  return (
    <div className={cn('mb-3', isFirst && 'mt-0')}>
      {/* Group header */}
      <div className="px-3 pt-1 pb-1">
        <h3 className="text-xs font-medium text-muted-foreground/80">{title}</h3>
      </div>

      {/* Group chats */}
      <div>
        {chats.map((chat, index) => (
          <ChatItem
            key={chat.id || `chat-${index}`}
            chat={chat}
            currentChatId={currentChatId}
            totalChats={totalChats}
            isSignedIn={isSignedIn}
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
