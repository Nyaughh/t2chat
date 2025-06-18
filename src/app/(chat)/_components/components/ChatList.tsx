'use client'

import { memo } from 'react'
import { ChatGroup } from './ChatGroup'
import { ConvexChat } from '@/lib/types'

interface ChatListProps {
  groupedChats: Array<{
    title: string
    chats: Array<{ id: string; title: string; isBranch?: boolean }>
  }>
  currentChatId: string | null
  totalChats: number
  editingChatId: string | null
  isSignedIn: boolean
  onChatSelect: (chatId: string) => void
  onChatDelete: (chatId: string) => void
  onChatRename: (chatId: string, currentTitle: string) => void
  onChatShare: (chatId: string) => void
}

export const ChatList = memo(function ChatList({
  groupedChats,
  currentChatId,
  totalChats,
  editingChatId,
  isSignedIn,
  onChatSelect,
  onChatDelete,
  onChatRename,
  onChatShare,
}: ChatListProps) {
  return (
    <div className="flex-1 min-h-0 px-4">
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="py-2">
          {groupedChats.map((group, groupIndex) => (
            <ChatGroup
              key={group.title + groupIndex}
              title={group.title}
              chats={group.chats}
              currentChatId={currentChatId}
              totalChats={totalChats}
              editingChatId={editingChatId}
              isFirst={groupIndex === 0}
              isSignedIn={isSignedIn}
              onChatSelect={onChatSelect}
              onChatDelete={onChatDelete}
              onChatRename={onChatRename}
              onChatShare={onChatShare}
            />
          ))}

          {/* Show message when no conversations exist */}
          {totalChats === 0 && (
            <div className="text-center py-8 px-4">
              <div className="text-black/40 dark:text-white/40 text-sm">No conversations yet</div>
              <div className="text-black/30 dark:text-white/30 text-xs mt-1">Start a new chat to begin</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
