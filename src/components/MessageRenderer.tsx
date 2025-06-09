"use client";

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

interface MessageRendererProps {
  content: string;
  className?: string;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ content, className = "" }) => {
  const { theme } = useTheme();
  
  // Function to parse and render message content with code highlighting
  const parseContent = (text: string) => {
    const parts = [];
    let lastIndex = 0;
    
    // Regex to match code blocks (```language\ncode\n```)
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        parts.push(renderTextWithInlineCode(beforeText, parts.length));
      }
      
      // Add code block
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      parts.push(
        <div key={parts.length} className="my-4 group relative">
          <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 px-4 py-2 rounded-t-lg border-b border-black/10 dark:border-white/10">
            <span className="text-xs font-medium text-black/60 dark:text-white/60 uppercase tracking-wide">
              {language}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="opacity-0 group-hover:opacity-100 text-xs text-black/50 dark:text-white/50 hover:text-rose-500 dark:hover:text-rose-300 transition-all duration-200 px-2 py-1 rounded"
            >
              Copy
            </button>
          </div>
          <div className="overflow-x-auto">
            <SyntaxHighlighter
              language={language}
              style={theme === 'dark' ? oneDark : oneLight}
              customStyle={{
                margin: 0,
                borderRadius: '0 0 8px 8px',
                background: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
              showLineNumbers={code.split('\n').length > 5}
              wrapLines={true}
              wrapLongLines={true}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </div>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      parts.push(renderTextWithInlineCode(remainingText, parts.length));
    }
    
    return parts.length > 0 ? parts : [renderTextWithInlineCode(text, 0)];
  };
  
  // Function to handle inline code (`code`)
  const renderTextWithInlineCode = (text: string, keyPrefix: number) => {
    const parts = [];
    let lastIndex = 0;
    
    // Regex to match inline code (`code`)
    const inlineCodeRegex = /`([^`]+)`/g;
    
    let match;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      // Add text before inline code
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        parts.push(renderPlainText(beforeText, `${keyPrefix}-${parts.length}`));
      }
      
      // Add inline code
      parts.push(
        <code
          key={`${keyPrefix}-${parts.length}`}
          className="px-1.5 py-0.5 text-sm bg-black/8 dark:bg-white/10 text-rose-600 dark:text-rose-300 rounded font-mono"
        >
          {match[1]}
        </code>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      parts.push(renderPlainText(remainingText, `${keyPrefix}-${parts.length}`));
    }
    
    return parts.length > 0 ? (
      <span key={keyPrefix}>{parts}</span>
    ) : (
      renderPlainText(text, keyPrefix.toString())
    );
  };
  
  // Function to render plain text with line breaks
  const renderPlainText = (text: string, key: string) => {
    return (
      <span key={key}>
        {text.split('\n').map((line, index, array) => (
          <React.Fragment key={index}>
            {line}
            {index < array.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  };
  
  return (
    <div className={className}>
      {parseContent(content)}
    </div>
  );
};

export default MessageRenderer; 