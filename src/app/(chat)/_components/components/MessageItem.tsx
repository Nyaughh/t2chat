'use client'

import { Edit3 } from 'lucide-react'
import MessageRenderer from '@/components/MessageRenderer'
import { EditMessageForm } from './EditMessageForm'
import { MessageActions } from './MessageActions'

interface MessageItemProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    thinking?: string
    thinkingDuration?: number
    modelId?: string
  }
  editingMessageId: string | null
  editingContent: string
  copiedId: string | null
  retryDropdownId: string | null
  selectedModel: string
  isStreaming: boolean
  editInputRef: React.RefObject<HTMLTextAreaElement | null>
  isCurrentlyStreaming: (messageId: string) => boolean
  onEditingContentChange: (content: string) => void
  onEditKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onStartEditing: (messageId: string, content: string) => void
  onCancelEditing: () => void
  onSaveEdit: () => void
  onCopy: (text: string, messageId: string) => void
  onRetryClick: (messageId: string) => void
  onRetryWithModel: (messageId: string, modelId: string) => void
  onCloseRetryDropdown: () => void
  getModelDisplayName: (modelId?: string) => string | null
  getProviderColor: (modelId?: string) => string
}

export function MessageItem({
  message,
  editingMessageId,
  editingContent,
  copiedId,
  retryDropdownId,
  selectedModel,
  isStreaming,
  editInputRef,
  isCurrentlyStreaming,
  onEditingContentChange,
  onEditKeyDown,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onCopy,
  onRetryClick,
  onRetryWithModel,
  onCloseRetryDropdown,
  getModelDisplayName,
  getProviderColor,
}: MessageItemProps) {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`group flex flex-col gap-2 min-w-0 ${message.role === 'user' ? 'max-w-[85%]' : 'w-full'}`}>
        <div
          className={`px-4 py-3 break-words overflow-wrap-anywhere ${
            message.role === 'user'
              ? 'bg-rose-500/5 dark:bg-rose-300/5 text-black dark:text-white rounded-lg'
              : 'text-black dark:text-white'
          }`}
        >
          {editingMessageId === message.id ? (
            <EditMessageForm
              content={editingContent}
              editInputRef={editInputRef}
              onContentChange={onEditingContentChange}
              onKeyDown={onEditKeyDown}
              onCancel={onCancelEditing}
              onSave={onSaveEdit}
            />
          ) : (
            <MessageRenderer
              content={message.content}
              thinking={message.thinking}
              thinkingDuration={message.thinkingDuration}
              isTyping={message.role === 'assistant' && isCurrentlyStreaming(message.id)}
              className="text-base leading-relaxed break-words overflow-wrap-anywhere"
            />
          )}
        </div>

        {message.role === 'assistant' && !isCurrentlyStreaming(message.id) && (
          <MessageActions
            messageId={message.id}
            content={message.content}
            modelId={message.modelId}
            copiedId={copiedId}
            retryDropdownId={retryDropdownId}
            selectedModel={selectedModel}
            isStreaming={isStreaming}
            onCopy={onCopy}
            onRetryClick={onRetryClick}
            onRetryWithModel={onRetryWithModel}
            onCloseRetryDropdown={onCloseRetryDropdown}
            getModelDisplayName={getModelDisplayName}
            getProviderColor={getProviderColor}
          />
        )}

        {message.role === 'user' && editingMessageId !== message.id && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
            <button
              onClick={() => onStartEditing(message.id, message.content)}
              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
              title="Edit message"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 