import { cn } from '@/lib/utils'
import { marked } from 'marked'
import type * as React from 'react'
import { Suspense, isValidElement, memo, useMemo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import 'katex/dist/katex.min.css'

const DEFAULT_PRE_BLOCK_CLASS =
  'my-4 overflow-x-auto w-fit rounded-xl bg-zinc-950 text-zinc-50 dark:bg-zinc-900 border border-border p-4'

const extractTextContent = (node: React.ReactNode): string => {
  if (typeof node === 'string') {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('')
  }
  if (isValidElement(node) && node.props && typeof node.props === 'object' && 'children' in node.props) {
    return extractTextContent(node.props.children as React.ReactNode)
  }
  return ''
}

interface CodeBlockProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  theme?: string
  [key: string]: any
}

const CodeBlock = memo(({ inline, className, children, theme = 'dark', ...props }: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!inline && language) {
    const code = String(children).replace(/\n$/, '')
    return (
      <div className="my-4 last:mb-0 group relative overflow-x-auto max-w-[87vw] md:max-w-full">
        <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 px-4 py-2 rounded-t-lg border-b border-black/10 dark:border-white/10">
          <span className="text-xs font-medium text-black/60 dark:text-white/60 uppercase tracking-wide">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 text-xs text-black/50 dark:text-white/50 hover:text-rose-500 dark:hover:text-rose-300 transition-all duration-200 px-2 py-1 rounded"
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
    <code className={cn('rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm', className)} {...props}>
      {children}
    </code>
  )
})

CodeBlock.displayName = 'CodeBlock'

const components: Partial<Components> = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-2 scroll-m-20 text-4xl font-bold" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-8 scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-4 scroll-m-20 text-xl font-semibold tracking-tight" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="mt-4 scroll-m-20 text-lg font-semibold tracking-tight" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5 className="mt-4 scroll-m-20 text-lg font-semibold tracking-tight" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6 className="mt-4 scroll-m-20 text-base font-semibold tracking-tight" {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="leading-6 [&:not(:first-child)]:mt-4" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <span className="font-semibold" {...props}>
      {children}
    </span>
  ),
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="font-medium underline underline-offset-4" target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-4 ml-6 list-decimal" {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-4 ml-6 list-disc" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="mt-2" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="mt-4 border-l-2 pl-6 italic" {...props}>
      {children}
    </blockquote>
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => <hr className="my-4 md:my-8" {...props} />,
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="relative w-full overflow-hidden border-none text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="last:border-b-none m-0 border-b" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right" {...props}>
      {children}
    </td>
  ),
  img: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/a11y/useAltText: alt is not required
    <img className="rounded-md" alt={alt} {...props} />
  ),
  code: ({ children, node, className, ...props }) => {
    const match = /language-(\w+)/.exec(className || '')
    if (match) {
      return (
        <CodeBlock inline={false} language={match[1]} className={cn('overflow-x-auto', className)} {...props}>
          {children}
        </CodeBlock>
      )
    }
    return (
      <code
        className={cn('rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm overflow-x-auto', className)}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  if (!markdown) {
    return []
  }
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

interface MarkdownBlockProps {
  content: string
  className?: string
}

const MemoizedMarkdownBlock = memo(
  ({ content, className }: MarkdownBlockProps) => {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {content}
      </ReactMarkdown>
    )
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) {
      return false
    }
    return true
  },
)

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock'

interface MarkdownContentProps {
  content: string
  id: string
  className?: string
}

export const MarkdownContent = memo(({ content, id, className }: MarkdownContentProps) => {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content || ''), [content])

  return blocks.map((block, index) => (
    <MemoizedMarkdownBlock
      content={block}
      className={className}
      key={`${id}-block_${
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        index
      }`}
    />
  ))
})

MarkdownContent.displayName = 'MarkdownContent'
