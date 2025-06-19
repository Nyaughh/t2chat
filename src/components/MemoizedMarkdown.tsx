import { marked } from 'marked'
import { memo, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

// Generate a stable hash from string content
function generateContentHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

interface CodeProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  theme?: string
  [key: string]: any
}

const CodeComponent = memo(({ inline, className, children, theme, ...props }: CodeProps) => {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''

  if (!inline && language) {
    const code = String(children).replace(/\n$/, '')
    const handleCopy = () => {
      navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    return (
      <div className="my-4 last:mb-0 group relative w-full max-w-full">
        <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 px-4 py-2 rounded-t-lg border-b border-black/10 dark:border-white/10">
          <span className="text-xs font-medium text-black/60 dark:text-white/60 uppercase tracking-wide">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="text-xs text-black/50 dark:text-white/50 hover:text-rose-500 dark:hover:text-rose-300 transition-all duration-200 px-2 py-1 rounded"
          >
            {copied ? 'Copied!' : 'Copy'}
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
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
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
    )
  }

  return (
    <code
      className="px-1.5 py-0.5 text-sm bg-black/8 dark:bg-white/10 text-rose-600 dark:text-rose-300 rounded font-mono"
      {...props}
    >
      {children}
    </code>
  )
})

CodeComponent.displayName = 'CodeComponent'

const MemoizedMarkdownBlock = memo(
  ({ content, theme }: { content: string; theme?: string }) => {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: (props: any) => (
              <CodeComponent inline={props.inline} className={props.className} theme={theme} {...props}>
                {props.children}
              </CodeComponent>
            ),
            p: ({ children, ...props }) => (
              <p className="mb-4 last:mb-0 leading-relaxed" {...props}>
                {children}
              </p>
            ),
            h1: ({ children, ...props }) => (
              <h1 className="text-3xl font-bold mb-6 mt-8 leading-tight" {...props}>
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2 className="text-2xl font-semibold mb-4 mt-6 leading-tight" {...props}>
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3 className="text-xl font-semibold mb-3 mt-5 leading-tight" {...props}>
                {children}
              </h3>
            ),
            h4: ({ children, ...props }) => (
              <h4 className="text-lg font-semibold mb-2 mt-4 leading-tight" {...props}>
                {children}
              </h4>
            ),
            ul: ({ children, ...props }) => (
              <ul className="mb-4 last:mb-0 space-y-2" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="mb-4 last:mb-0 space-y-2" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className="leading-relaxed" {...props}>
                {children}
              </li>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="border-l-4 border-rose-400 dark:border-rose-300 pl-4 py-2 my-4 last:mb-0 italic bg-black/5 dark:bg-white/5 rounded-r"
                {...props}
              >
                {children}
              </blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.theme === nextProps.theme
  },
)

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock'

export const MemoizedMarkdown = memo(
  ({ content, id, theme }: { content: string; id?: string; theme?: string }) => {
    const contentHash = useMemo(() => generateContentHash(content), [content])
    const stableId = id || `md-${contentHash}`

    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content])

    return (
      <div>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock content={block} theme={theme} key={`${stableId}-block_${index}`} />
        ))}
      </div>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content && prevProps.theme === nextProps.theme && prevProps.id === nextProps.id
    )
  },
)

MemoizedMarkdown.displayName = 'MemoizedMarkdown'
