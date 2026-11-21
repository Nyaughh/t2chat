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
  showTimestamps?: boolean
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
  showTimestamps = false,
}: MessageListProps) {
  return (
    <ScrollArea className="h-full scrollbar-hide" ref={scrollAreaRef}>
      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-16 pb-48 md:pb-40">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            showTimestamps={showTimestamps}
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
              <div className="px-0.5 py-2 text-foreground" role="status" aria-label="Generating response">
                <div className="flex items-center gap-1">
                  <div className="size-1.5 animate-bounce rounded-full bg-rose-500/50 dark:bg-rose-300/50"></div>
                  <div className="size-1.5 animate-bounce rounded-full bg-rose-500/50 delay-100 dark:bg-rose-300/50"></div>
                  <div className="size-1.5 animate-bounce rounded-full bg-rose-500/50 delay-200 dark:bg-rose-300/50"></div>
                </div>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}
