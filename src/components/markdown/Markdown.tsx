'use client'

import { cn } from '@/lib/utils'
import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert } from 'lucide-react'
import {
  createContext,
  memo,
  useContext,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import ReactMarkdown, { type Components, type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { analyze, type Footnote } from './analyze'
import { CodeBlock } from './CodeBlock'
import { useMathPlugins } from './math'
import {
  normalizeMathDelimiters,
  remarkAlerts,
  remarkFootnoteRefs,
  remarkHtmlAsText,
  repairStreamingTail,
} from './plugins'
import './markdown.css'

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function hastText(node: HastNode | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

/** Safe fragment for an element id built from a footnote label. */
const idPart = (label: string) => label.replace(/[^a-zA-Z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)

// ---------------------------------------------------------------------------
// Contexts

/** Which block an element is in, and whether that block is still streaming. */
const BlockContext = createContext({ index: 0, streaming: false })

type FootnoteInfo = {
  /** Unique per rendered message, so ids never collide across messages. */
  prefix: string
  numbers: Record<string, number>
  /** Index of the block holding the first reference to each label. */
  firstBlock: Record<string, number>
}
const FootnoteContext = createContext<FootnoteInfo>({ prefix: 'md', numbers: {}, firstBlock: {} })

/** True inside a link, so images don't add a second, nested anchor. */
const LinkContext = createContext(false)

// ---------------------------------------------------------------------------
// Element renderers

function Pre({ node, children }: ComponentProps<'pre'> & { node?: HastNode }) {
  const { streaming } = useContext(BlockContext)
  const codeEl = node?.children?.find((c) => c.type === 'element' && c.tagName === 'code')
  if (!codeEl) return <pre>{children}</pre>
  const classes = (codeEl.properties?.className as string[] | undefined) ?? []
  const langClass = classes.find((c) => typeof c === 'string' && c.startsWith('language-'))
  const lang = langClass?.slice('language-'.length)
  const code = hastText(codeEl).replace(/\n$/, '')
  return <CodeBlock code={code} lang={lang} streaming={streaming} />
}

function InlineCode({ node: _node, className, children, ...rest }: ComponentProps<'code'> & { node?: unknown }) {
  return (
    <code className={cn('md-inline-code', className)} {...rest}>
      {children}
    </code>
  )
}

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer nofollow ugc' } as const

function Link({ node: _node, href, children, ...rest }: ComponentProps<'a'> & { node?: unknown }) {
  const footnotes = useContext(FootnoteContext)
  const block = useContext(BlockContext)
  const props = rest as Record<string, unknown>
  const fnId = props['data-fn-id'] as string | undefined

  // A message-level footnote reference (see remarkFootnoteRefs).
  if (fnId !== undefined) {
    const n = footnotes.numbers[fnId]
    const first = props['data-fn-first'] === 'true' && footnotes.firstBlock[fnId] === block.index
    return (
      <a
        href={`#${footnotes.prefix}-fn-${idPart(fnId)}`}
        id={first ? `${footnotes.prefix}-fnref-${idPart(fnId)}` : undefined}
        data-footnote-ref=""
        aria-label={`Footnote ${n}`}
      >
        {n}
      </a>
    )
  }

  // `href` has already been through react-markdown's urlTransform, which
  // blanks javascript:, data:, vbscript: and other unsafe protocols. A
  // blocked URL shows as text, not as a dead link.
  if (!href) return <span>{children}</span>
  const internal = href.startsWith('#')
  return (
    <LinkContext.Provider value={true}>
      <a href={href} {...rest} {...(internal ? {} : EXTERNAL)}>
        {children}
      </a>
    </LinkContext.Provider>
  )
}

function MdImage({ node: _node, src, alt, title }: ComponentProps<'img'> & { node?: unknown }) {
  const inLink = useContext(LinkContext)
  const url = typeof src === 'string' ? src : ''
  // Remember which URL failed, so a changed src gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url || failedUrl === url) {
    return (
      <span className="md-img-fallback" title={url || undefined}>
        {alt || 'Image unavailable'}
      </span>
    )
  }
  const img = (
    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URLs from model output */
    <img
      src={url}
      alt={alt ?? ''}
      title={title}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  )
  // Inside a link, the link decides where a click goes.
  if (inLink) return img
  return (
    <a href={url} className="md-img-link" {...EXTERNAL}>
      {img}
    </a>
  )
}

function Table({ node: _node, children, ...rest }: ComponentProps<'table'> & { node?: unknown }) {
  return (
    <div className="md-table-wrap">
      <table {...rest}>{children}</table>
    </div>
  )
}

function Input({ node: _node, type, checked }: ComponentProps<'input'> & { node?: unknown }) {
  if (type !== 'checkbox') return null
  return (
    <span className="md-task-check" data-checked={checked || undefined} role="img" aria-label={checked ? 'Done' : 'Not done'}>
      {checked && (
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

const ALERTS: Record<string, { title: string; icon: ReactNode }> = {
  note: { title: 'Note', icon: <Info aria-hidden /> },
  tip: { title: 'Tip', icon: <Lightbulb aria-hidden /> },
  important: { title: 'Important', icon: <MessageSquareWarning aria-hidden /> },
  warning: { title: 'Warning', icon: <TriangleAlert aria-hidden /> },
  caution: { title: 'Caution', icon: <OctagonAlert aria-hidden /> },
}

function Blockquote({ node: _node, children, ...rest }: ComponentProps<'blockquote'> & { node?: unknown }) {
  const kind = (rest as Record<string, unknown>)['data-alert'] as string | undefined
  const alert = kind ? ALERTS[kind] : undefined
  if (!alert) return <blockquote>{children}</blockquote>
  return (
    <blockquote className="md-alert" data-alert={kind}>
      <p className="md-alert-title">
        {alert.icon}
        {alert.title}
      </p>
      {children}
    </blockquote>
  )
}

const components: Components = {
  pre: Pre as Components['pre'],
  code: InlineCode,
  a: Link,
  img: MdImage,
  table: Table,
  input: Input,
  blockquote: Blockquote,
}

// ---------------------------------------------------------------------------
// Plugins

type Plugins = NonNullable<Options['remarkPlugins']>

const REMARK_BASE: Plugins = [remarkGfm, remarkAlerts, remarkHtmlAsText, remarkFootnoteRefs]
const REHYPE_BASE: Plugins = []

const withMathCache = new WeakMap<object, { remark: Plugins; rehype: Plugins }>()

function usePlugins(needsMath: boolean) {
  const math = useMathPlugins(needsMath)
  if (!math) return { remark: REMARK_BASE, rehype: REHYPE_BASE }
  let cached = withMathCache.get(math)
  if (!cached) {
    cached = { remark: [...REMARK_BASE, ...math.remark], rehype: [...REHYPE_BASE, ...math.rehype] }
    withMathCache.set(math, cached)
  }
  return cached
}

// ---------------------------------------------------------------------------
// Rendering

type BlockProps = { content: string; kind: string; math: boolean; index: number; streaming: boolean; prefix: string }

const Block = memo(function Block({ content, kind, math, index, streaming, prefix }: BlockProps) {
  const plugins = usePlugins(math)
  const source = useMemo(() => {
    const normalized = normalizeMathDelimiters(content)
    // A code block repairs nothing: an open fence already renders as code.
    return streaming && kind !== 'code' ? repairStreamingTail(normalized) : normalized
  }, [content, kind, streaming])
  const rehypeOptions = useMemo(() => ({ clobberPrefix: `${prefix}-` }), [prefix])
  const blockInfo = useMemo(() => ({ index, streaming }), [index, streaming])
  return (
    <BlockContext.Provider value={blockInfo}>
      <ReactMarkdown
        remarkPlugins={plugins.remark}
        rehypePlugins={plugins.rehype}
        remarkRehypeOptions={rehypeOptions}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </BlockContext.Provider>
  )
})

function Footnotes({ footnotes, prefix }: { footnotes: Footnote[]; prefix: string }) {
  return (
    <section className="footnotes" data-footnotes aria-label="Footnotes">
      <ol>
        {footnotes.map((f, i) => (
          <li key={f.id} id={`${prefix}-fn-${idPart(f.id)}`}>
            <Block
              content={f.content}
              kind="footnote"
              math={/\$|\\\(|\\\[/.test(f.content)}
              index={-1 - i}
              streaming={false}
              prefix={prefix}
            />
            <a href={`#${prefix}-fnref-${idPart(f.id)}`} className="md-fn-back" aria-label={`Back to reference ${i + 1}`}>
              {/* ↩ with U+FE0E: text presentation, not the emoji glyph */}
              {'↩︎'}
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

export interface MarkdownProps {
  content: string
  /** The message is still streaming. Only its last block re-renders. */
  streaming?: boolean
  /** Smaller type for secondary content such as reasoning. */
  variant?: 'default' | 'compact'
  className?: string
}

export const Markdown = memo(function Markdown({ content, streaming = false, variant = 'default', className }: MarkdownProps) {
  const prefix = `md${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { blocks, footnotes, numbers, firstBlock } = useMemo(
    () => analyze((content ?? '').replace(/\r\n?/g, '\n')),
    [content],
  )
  const signature = JSON.stringify([numbers, firstBlock])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized maps
  const footnoteInfo = useMemo(() => ({ prefix, numbers, firstBlock }), [prefix, signature])

  return (
    <FootnoteContext.Provider value={footnoteInfo}>
      <div className={cn('md', variant === 'compact' && 'md-compact', className)}>
        {blocks.map((block, i) => (
          // Index keys are stable while streaming: blocks only ever append.
          <Block
            key={i}
            content={block.content}
            kind={block.kind}
            math={block.math}
            index={i}
            streaming={streaming && i === blocks.length - 1}
            prefix={prefix}
          />
        ))}
        {footnotes.length > 0 && <Footnotes footnotes={footnotes} prefix={prefix} />}
      </div>
    </FootnoteContext.Provider>
  )
})

export default Markdown
