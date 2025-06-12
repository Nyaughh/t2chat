'use client'

import React, { memo, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { MemoizedMarkdown } from './MemoizedMarkdown'
import { MarkdownContent } from './ui/markdown-content'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageRendererProps {
  content: string
  thinking?: string
  thinkingDuration?: number
  isTyping?: boolean
  className?: string
}

const MessageRenderer: React.FC<MessageRendererProps> = memo(({ 
  content, 
  thinking, 
  thinkingDuration, 
  isTyping = false,
  className = '' 
}) => {
  const { theme } = useTheme()
  const [isThinkingCollapsed, setIsThinkingCollapsed] = useState(true)

  // Generate a stable ID based on content
  const messageId = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `message-${Math.abs(hash).toString(36)}`;
  }, [content]);

  // Generate a stable ID for thinking content
  const thinkingId = useMemo(() => {
    if (!thinking) return '';
    let hash = 0;
    for (let i = 0; i < thinking.length; i++) {
      const char = thinking.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `thinking-${Math.abs(hash).toString(36)}`;
  }, [thinking]);

  return (
    <div className={className}>
      {/* Thinking section */}
      {(thinking || (isTyping && !content)) && (
        <div className="mb-3">
          <button
            onClick={() => setIsThinkingCollapsed(!isThinkingCollapsed)}
            className="flex items-center gap-2 w-full text-left group py-2 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span className={cn(
                "text-sm font-medium",
                isTyping && !thinkingDuration 
                  ? "text-black/60 dark:text-white/60" 
                  : "text-black/50 dark:text-white/50"
              )}>
                {isTyping && !thinkingDuration 
                  ? (
                    <span 
                      className="animate-[shine_2s_ease-in-out_infinite]"
                      style={{
                        background: 'linear-gradient(90deg, currentColor 50%, transparent 50%, currentColor 50%)',
                        backgroundSize: '200% 100%',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        color: 'inherit'
                      }}
                    >
                      Thinking...
                    </span>
                  )
                  : thinkingDuration 
                    ? `Thought for ${thinkingDuration} second${thinkingDuration !== 1 ? 's' : ''}`
                    : "Thinking"
                }
                <ChevronDown 
                  className={cn(
                    "w-5 h-5 text-black/40 dark:text-white/40 transition-transform duration-200 ml-3 inline-block mb-[6px]",
                    !isThinkingCollapsed && "rotate-180"
                  )}
                />
              </span>
            </div>
          </button>
          
          {!isThinkingCollapsed && thinking && (
            <div className="mt-2 p-3 rounded-lg opacity-80">
              <div className="text-black/70 dark:text-white/70">
                <MarkdownContent content={thinking} id={thinkingId} />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Main content */}
      {content && (
        <MarkdownContent content={content} id={messageId} />
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content && 
    prevProps.thinking === nextProps.thinking &&
    prevProps.thinkingDuration === nextProps.thinkingDuration &&
    prevProps.isTyping === nextProps.isTyping &&
    prevProps.className === nextProps.className
  );
});

MessageRenderer.displayName = 'MessageRenderer';

export default MessageRenderer
