import { marked } from 'marked';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Generate a stable hash from string content
function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map(token => token.raw);
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  theme?: string;
  [key: string]: any;
}

const CodeComponent = memo(({ inline, className, children, theme, ...props }: CodeProps) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  if (!inline && language) {
    const code = String(children).replace(/\n$/, '');
    return (
      <div className="my-4 group relative w-full max-w-full">
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
        <div className="overflow-x-auto w-full">
          <SyntaxHighlighter
            language={language}
            style={theme === 'dark' ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              borderRadius: '0 0 8px 8px',
              background: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
              fontSize: '14px',
              lineHeight: '1.5',
              width: '100%',
              maxWidth: '100%',
            }}
            showLineNumbers={code.split('\n').length > 5}
            wrapLines={true}
            wrapLongLines={true}
            {...props}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  return (
    <code 
      className="px-1.5 py-0.5 text-sm bg-black/8 dark:bg-white/10 text-rose-600 dark:text-rose-300 rounded font-mono" 
      {...props}
    >
      {children}
    </code>
  );
});

CodeComponent.displayName = 'CodeComponent';

const MemoizedMarkdownBlock = memo(
  ({ content, theme }: { content: string; theme?: string }) => {
    return (
      <ReactMarkdown
                 components={{
           code: (props: any) => (
             <CodeComponent 
               inline={props.inline} 
               className={props.className} 
               theme={theme}
               {...props}
             >
               {props.children}
             </CodeComponent>
           ),
         }}
      >
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.theme === nextProps.theme;
  },
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedMarkdown = memo(
  ({ content, id, theme }: { content: string; id?: string; theme?: string }) => {
    const contentHash = useMemo(() => generateContentHash(content), [content]);
    const stableId = id || `md-${contentHash}`;
    
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return (
      <div>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock 
            content={block} 
            theme={theme}
            key={`${stableId}-block_${index}`} 
          />
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && 
           prevProps.theme === nextProps.theme &&
           prevProps.id === nextProps.id;
  }
);

MemoizedMarkdown.displayName = 'MemoizedMarkdown';