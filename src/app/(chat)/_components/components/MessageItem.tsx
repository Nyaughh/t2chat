'use client'

import { Edit3, FileText, ExternalLink } from 'lucide-react'
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
    createdAt?: Date
  }
  /** User setting: show the time each message was sent. */
  showTimestamps?: boolean
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

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function MessageTime({ date }: { date?: Date }) {
  if (!date || Number.isNaN(date.getTime())) return null
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      className="text-xs text-muted-foreground/70 tabular-nums"
    >
      {timeFormatter.format(date)}
    </time>
  )
}

export function MessageItem({
  message,
  showTimestamps = false,
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
  const isUser = message.role === 'user'
  const isEditing = editingMessageId === message.id
  const hoverReveal =
    'transition-opacity duration-150 ease-[0.25,1,0.5,1] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        tabIndex={0}
        className={cn(
          'group flex min-w-0 flex-col gap-1 focus:outline-none',
          isUser ? 'max-w-[85%] items-end' : 'w-full',
          isUser && isEditing && 'w-full',
        )}
      >
        <div
          className={cn(
            'break-words overflow-wrap-anywhere text-foreground',
            isUser ? 'rounded-2xl bg-foreground/[0.045] px-3.5 py-2 dark:bg-foreground/[0.06]' : 'px-0.5 py-1',
            isUser && isEditing && 'w-full',
          )}
        >
          {isEditing ? (
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
                className="text-[15px] leading-relaxed break-words overflow-wrap-anywhere"
                modelId={message.modelId}
                toolCalls={message.toolCalls}
              />

              {/* Display attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={index}>
                      {attachment.type.startsWith('image/') ? (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/attachment relative block w-fit"
                          aria-label={`Open ${attachment.name}`}
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-h-64 max-w-full rounded-lg border border-border/60 sm:max-w-sm"
                          />
                          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md bg-black/40 text-white opacity-0 transition-opacity group-hover/attachment:opacity-100">
                            <ExternalLink className="size-3.5" />
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {attachment.name} ({(attachment.size / 1024).toFixed(1)}KB)
                          </span>
                        </a>
                      ) : (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-foreground/[0.03]"
                        >
                          <FileText className="size-5 shrink-0 text-rose-500/70 dark:text-rose-300/70" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground/90">{attachment.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)}KB • {attachment.type}
                            </span>
                          </span>
                          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {message.role === 'assistant' && !isCurrentlyStreaming(message.id) && (
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
            buttonsClassName={retryDropdownId === message.id ? undefined : hoverReveal}
            meta={showTimestamps ? <MessageTime date={message.createdAt} /> : null}
          />
        )}

        {isUser && !isEditing && (
          <div className="flex h-7 items-center justify-end gap-1.5">
            <button
              onClick={() => onStartEditing(message.id, message.content)}
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'cursor-pointer', hoverReveal)}
              title="Edit message"
              aria-label="Edit message"
            >
              <Edit3 />
            </button>
            {showTimestamps && <MessageTime date={message.createdAt} />}
          </div>
        )}
      </div>
    </div>
  )
}
