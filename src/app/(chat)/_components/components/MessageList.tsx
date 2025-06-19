'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageItem } from './MessageItem'
import { ModelInfo } from '@/lib/models'

interface MessageListProps {
  messages: any[]
  editingMessageId: string | null
  editingContent: string
  copiedId: string | null
  retryDropdownId: string | null
  speakingMessageId: string | null
  selectedModel: ModelInfo
  isStreaming: boolean
  editInputRef: React.RefObject<HTMLTextAreaElement | null>
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  isCurrentlyStreaming: (messageId: string) => boolean
  onEditingContentChange: (content: string) => void
  onEditKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onStartEditing: (messageId: string, content: string) => void
  onCancelEditing: () => void
  onSaveEdit: () => void
  onCopy: (text: string, messageId: string) => void
  onReadAloud: (text: string, messageId: string) => void
  onRetryClick: (messageId: string) => void
  onRetryWithModel: (messageId: string, modelId: string) => void
  onCloseRetryDropdown: () => void
  onBranch: (messageId: string) => void
  isSignedIn: boolean
}

export function MessageList({
  messages,
  editingMessageId,
  editingContent,
  copiedId,
  retryDropdownId,
  speakingMessageId,
  selectedModel,
  isStreaming,
  editInputRef,
  scrollAreaRef,
  messagesEndRef,
  isCurrentlyStreaming,
  onEditingContentChange,
  onEditKeyDown,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onCopy,
  onReadAloud,
  onRetryClick,
  onRetryWithModel,
  onCloseRetryDropdown,
  onBranch,
  isSignedIn,
}: MessageListProps) {
  return (
    <ScrollArea className="h-full scrollbar-hide" ref={scrollAreaRef}>
      <div className="pt-16 px-4 md:px-4 pb-48 md:pb-40 space-y-4 max-w-4xl mx-auto">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            editingMessageId={editingMessageId}
            editingContent={editingContent}
            copiedId={copiedId}
            retryDropdownId={retryDropdownId}
            speakingMessageId={speakingMessageId}
            selectedModel={selectedModel}
            isStreaming={isStreaming}
            editInputRef={editInputRef}
            isCurrentlyStreaming={isCurrentlyStreaming}
            onEditingContentChange={onEditingContentChange}
            onEditKeyDown={onEditKeyDown}
            onStartEditing={onStartEditing}
            onCancelEditing={onCancelEditing}
            onSaveEdit={onSaveEdit}
            onCopy={onCopy}
            onReadAloud={onReadAloud}
            onRetryClick={onRetryClick}
            onRetryWithModel={onRetryWithModel}
            onCloseRetryDropdown={onCloseRetryDropdown}
            onBranch={onBranch}
            isSignedIn={isSignedIn}
          />
        ))}

        {isStreaming &&
          messages[messages.length - 1]?.role === 'assistant' &&
          !messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="text-black dark:text-white px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}
