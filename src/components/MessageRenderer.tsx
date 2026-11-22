'use client'

import React, { Suspense, lazy, memo, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { models } from '@/lib/models'
import ToolCallDisplay from '@/app/(chat)/_components/components/ToolCallDisplay'

// The markdown renderer (react-markdown, remark/rehype, the block lexer) is
// its own chunk, loaded when the first message renders. Shiki grammars and
// KaTeX load later still, only when a message needs them.
const Markdown = lazy(() => import('./markdown/Markdown'))

/** Shown for the moment before the renderer chunk arrives: the raw text, same flow. */
function PlainText({ content, compact }: { content: string; compact?: boolean }) {
  return <div className={cn('md whitespace-pre-wrap', compact && 'md-compact')}>{content}</div>
}

function LazyMarkdown({ content, streaming, compact }: { content: string; streaming?: boolean; compact?: boolean }) {
  return (
    <Suspense fallback={<PlainText content={content} compact={compact} />}>
      <Markdown content={content} streaming={streaming} variant={compact ? 'compact' : 'default'} />
    </Suspense>
  )
}

interface MessageRendererProps {
  content: string
  thinking?: string
  thinkingDuration?: number
  isTyping?: boolean
  className?: string
  modelId?: string
  toolCalls?: any[]
}

const MessageRenderer: React.FC<MessageRendererProps> = memo(
  ({ content, thinking, thinkingDuration, isTyping = false, className = '', modelId, toolCalls }) => {
    const [isThinkingCollapsed, setIsThinkingCollapsed] = useState(true)

    // Check if the model supports thinking
    const modelSupportsThinking = useMemo(() => {
      if (!modelId) return false
      const model = models.find((m) => m.id === modelId)
      return model?.supportsThinking || false
    }, [modelId])

    const contentParts = useMemo(() => {
      if (!content) return []
      const regex = /(\[TOOL_CALL:[a-zA-Z0-9_-]+\])/g
      return content.split(regex).filter((part) => part)
    }, [content])

    return (
      <div className={className}>
        {/* Thinking section - only show for thinking-capable models */}
        {(thinking || (isTyping && !content && modelSupportsThinking)) && (
          <div className="mb-2">
            <button
              onClick={() => setIsThinkingCollapsed(!isThinkingCollapsed)}
              className="flex items-center gap-2 text-left group hover:bg-black/5 dark:hover:bg-white/5 rounded-md px-2 py-1 transition-colors"
            >
              <span
                className={cn(
                  'text-xs font-medium flex-1',
                  isTyping && !thinkingDuration
                    ? 'text-black/60 dark:text-white/60'
                    : 'text-black/50 dark:text-white/50',
                )}
              >
                {isTyping && !thinkingDuration ? (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block animate-[thinking-pulse_1.5s_ease-in-out_infinite]"
                      style={{ animationDelay: '0ms' }}
                    >
                      Thinking
                    </span>
                    <span
                      className="inline-flex"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '1em',
                        lineHeight: '1',
                      }}
                    >
                      <span
                        className="inline-block animate-[thinking-wave_1.4s_ease-in-out_infinite]"
                        style={{ animationDelay: '0ms' }}
                      >
                        .
                      </span>
                      <span
                        className="inline-block animate-[thinking-wave_1.4s_ease-in-out_infinite]"
                        style={{ animationDelay: '0.2s' }}
                      >
                        .
                      </span>
                      <span
                        className="inline-block animate-[thinking-wave_1.4s_ease-in-out_infinite]"
                        style={{ animationDelay: '0.4s' }}
                      >
                        .
                      </span>
                    </span>
                  </span>
                ) : thinkingDuration ? (
                  `Thought for ${thinkingDuration}s`
                ) : (
                  'Thinking'
                )}
              </span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-black/40 dark:text-white/40 transition-transform duration-200 flex-shrink-0',
                  !isThinkingCollapsed && 'rotate-180',
                )}
              />
            </button>

            {!isThinkingCollapsed && thinking && (
              <div className="mt-1 ml-6 pl-3 border-l-2 border-rose-500/20 dark:border-rose-300/20">
                <div className="text-xs text-black/70 dark:text-white/70 leading-relaxed">
                  <LazyMarkdown content={thinking} streaming={isTyping && !thinkingDuration} compact />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        {contentParts.map((part, index) => {
          const match = /\[TOOL_CALL:(.+)\]/.exec(part)
          if (match && toolCalls) {
            const toolCallId = match[1]
            const toolCall = toolCalls.find((tc) => tc.toolCallId === toolCallId)
            return toolCall ? <ToolCallDisplay key={`tool-${index}`} toolCalls={[toolCall]} /> : null
          }
          // Index keys: parts only append while streaming, so earlier parts keep their state.
          return (
            <LazyMarkdown
              key={`part-${index}`}
              content={part}
              streaming={isTyping && index === contentParts.length - 1}
            />
          )
        })}
      </div>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.thinking === nextProps.thinking &&
      prevProps.thinkingDuration === nextProps.thinkingDuration &&
      prevProps.isTyping === nextProps.isTyping &&
      prevProps.className === nextProps.className &&
      prevProps.modelId === nextProps.modelId &&
      prevProps.toolCalls === nextProps.toolCalls
    )
  },
)

MessageRenderer.displayName = 'MessageRenderer'

export default MessageRenderer
