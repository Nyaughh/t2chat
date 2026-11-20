'use client'

import { Edit3, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react'
import MessageRenderer from '@/components/MessageRenderer'
import { EditMessageForm } from './EditMessageForm'
import { MessageActions } from './MessageActions'
import { Attachment } from '@/lib/types'
import { ModelInfo } from '@/lib/models'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import ToolCallDisplay from './ToolCallDisplay'

interface MessageItemProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    thinking?: string
    thinkingDuration?: number
    modelId?: string
    attachments?: Attachment[]
    toolCalls?: any[]
  }
  editingMessageId: string | null
  editingContent: string
  copiedId: string | null
  retryDropdownId: string | null
  speakingMessageId: string | null
  selectedModel: ModelInfo
  isStreaming: boolean
  editInputRef: React.RefObject<HTMLTextAreaElement | null>
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

export function MessageItem({
  message,
  editingMessageId,
  editingContent,
  copiedId,
  retryDropdownId,
  speakingMessageId,
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
  onReadAloud,
  onRetryClick,
  onRetryWithModel,
  onCloseRetryDropdown,
  onBranch,
  isSignedIn,
}: MessageItemProps) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        tabIndex={0}
        className={cn(
          'group flex flex-col gap-2 min-w-0 focus:outline-none',
          message.role === 'user' ? 'max-w-[85%]' : 'w-full',
        )}
      >
        <div
          className={`px-4 py-3 break-words overflow-wrap-anywhere ${
            message.role === 'user'
              ? 'bg-rose-500/5 dark:bg-rose-300/5 text-foreground rounded-xl'
              : 'text-foreground'
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
            <>
              <MessageRenderer
                content={message.content}
                thinking={message.thinking}
                thinkingDuration={message.thinkingDuration}
                isTyping={message.role === 'assistant' && isCurrentlyStreaming(message.id)}
                className="text-base leading-relaxed break-words overflow-wrap-anywhere"
                modelId={message.modelId}
                toolCalls={message.toolCalls}
              />

              {/* Display attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={index}>
                      {attachment.type.startsWith('image/') ? (
                        <div className="relative group">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-w-full sm:max-w-sm max-h-64 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => window.open(attachment.url, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ExternalLink className="w-6 h-6 text-white drop-shadow-lg" />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {attachment.name} ({(attachment.size / 1024).toFixed(1)}KB)
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border hover:bg-muted/70 transition-colors cursor-pointer"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          <FileText className="w-8 h-8 text-rose-500/70 dark:text-rose-300/70 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground/90 truncate">
                              {attachment.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)}KB • {attachment.type}
                            </div>
                          </div>
                          <ExternalLink className="size-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {message.role === 'assistant' && !isCurrentlyStreaming(message.id) && (
          <div className="transition-opacity duration-150 ease-[0.25,1,0.5,1] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <MessageActions
              messageId={message.id}
              content={message.content}
              modelId={message.modelId}
              copiedId={copiedId}
              retryDropdownId={retryDropdownId}
              speakingMessageId={speakingMessageId}
              selectedModel={selectedModel}
              isStreaming={isStreaming}
              onCopy={onCopy}
              onReadAloud={onReadAloud}
              onRetryClick={onRetryClick}
              onRetryWithModel={onRetryWithModel}
              onCloseRetryDropdown={onCloseRetryDropdown}
              onBranch={onBranch}
              isSignedIn={isSignedIn}
            />
          </div>
        )}

        {message.role === 'user' && editingMessageId !== message.id && (
          <div className="flex items-center justify-end gap-0.5 transition-opacity duration-150 ease-[0.25,1,0.5,1] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button
              onClick={() => onStartEditing(message.id, message.content)}
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'cursor-pointer')}
              title="Edit message"
              aria-label="Edit message"
            >
              <Edit3 />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
