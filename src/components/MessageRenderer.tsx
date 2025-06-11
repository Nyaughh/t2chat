'use client'

import React, { memo, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { MemoizedMarkdown } from './MemoizedMarkdown'

interface MessageRendererProps {
  content: string
  className?: string
}

const MessageRenderer: React.FC<MessageRendererProps> = memo(({ content, className = '' }) => {
  const { theme } = useTheme()

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

  return (
    <div className={className}>
      <MemoizedMarkdown content={content} id={messageId} theme={theme} />
    </div>
  )
}, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content && prevProps.className === nextProps.className;
});

MessageRenderer.displayName = 'MessageRenderer';

export default MessageRenderer
