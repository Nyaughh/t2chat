'use client'

import { ChatGroup } from './ChatGroup'

interface ChatListProps {
  groupedChats: Array<{
    title: string
    chats: Array<{ id: string; title: string }>
  }>
  currentChatId: string | null
  totalChats: number
  onChatSelect: (chatId: string) => void
  onChatDelete: (chatId: string) => void
}

export function ChatList({
  groupedChats,
  currentChatId,
  totalChats,
  onChatSelect,
  onChatDelete,
}: ChatListProps) {
  return (
    <div className="flex-1 min-h-0 px-4">
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="py-2">
          {groupedChats.map((group, groupIndex) => (
            <ChatGroup
              key={group.title}
              title={group.title}
              chats={group.chats}
              currentChatId={currentChatId}
              totalChats={totalChats}
              isFirst={groupIndex === 0}
              onChatSelect={onChatSelect}
              onChatDelete={onChatDelete}
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
} 