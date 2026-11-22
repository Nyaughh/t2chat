'use client'

import { Check, Copy, WrapText } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  IncrementalTokenizer,
  TOKEN_CLASSES,
  ensureLang,
  getVersion,
  isLangReady,
  langLabel,
  normalizeLang,
  subscribe,
  tokenizeCached,
  type Line,
} from './highlighter'

// Blocks longer than this aren't highlighted. They still render, as plain text.
const MAX_HIGHLIGHT_CHARS = 100_000

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for insecure contexts and older browsers.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** One line of code. Memoized by reference: committed lines keep their identity while streaming. */
const CodeLine = memo(function CodeLine({ line }: { line: Line }) {
  return (
    <span className="md-code-line">
      {line.map((t, i) =>
        t.cls === 0 && !t.italic ? (
          t.content
        ) : (
          <span key={i} className={`tk-${TOKEN_CLASSES[t.cls]}${t.italic ? ' tk-italic' : ''}`}>
            {t.content}
          </span>
        ),
      )}
      {'\n'}
    </span>
  )
})

const PlainLine = memo(function PlainLine({ text }: { text: string }) {
  return (
    <span className="md-code-line">
      {text}
      {'\n'}
    </span>
  )
})

function useHighlightedLines(code: string, lang: string, streaming: boolean): Line[] | null {
  const highlightable = lang !== 'text' && code.length <= MAX_HIGHLIGHT_CHARS
  // Re-render when the grammar finishes loading.
  useSyncExternalStore(subscribe, getVersion, getVersion)
  useEffect(() => {
    if (highlightable) ensureLang(lang)
  }, [highlightable, lang])

  const tokenizerRef = useRef<{ lang: string; tokenizer: IncrementalTokenizer } | null>(null)
  const lastRef = useRef<{ code: string; lang: string; lines: Line[] } | null>(null)
  const isReady = highlightable && isLangReady(lang)

  return useMemo(() => {
    if (!isReady) return null
    const last = lastRef.current
    if (last && last.code === code && last.lang === lang) return last.lines
    let lines: Line[]
    try {
      if (streaming) {
        if (!tokenizerRef.current || tokenizerRef.current.lang !== lang) {
          tokenizerRef.current = { lang, tokenizer: new IncrementalTokenizer(lang) }
        }
        lines = tokenizerRef.current.tokenizer.tokenize(code)
      } else {
        tokenizerRef.current = null
        lines = tokenizeCached(code, lang)
      }
    } catch {
      return null
    }
    lastRef.current = { code, lang, lines }
    return lines
  }, [isReady, code, lang, streaming])
}

interface CodeBlockProps {
  code: string
  lang?: string
  /** True while this block is still being streamed. */
  streaming?: boolean
}

export const CodeBlock = memo(function CodeBlock({ code, lang: rawLang, streaming = false }: CodeBlockProps) {
  const lang = normalizeLang(rawLang)
  const label = langLabel(rawLang)
  const lines = useHighlightedLines(code, lang, streaming)
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const onCopy = useCallback(async () => {
    if (await copyText(code)) {
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    }
  }, [code])

  const plainLines = useMemo(() => (lines ? null : code.split('\n')), [lines, code])

  return (
    <div className="md-code" data-wrap={wrap || undefined} data-streaming={streaming || undefined}>
      <div className="md-code-header">
        <span className="md-code-lang">{label}</span>
        <div className="md-code-actions">
          <button
            type="button"
            className="md-code-button"
            onClick={() => setWrap((w) => !w)}
            aria-pressed={wrap}
            aria-label={wrap ? 'Disable line wrapping' : 'Wrap long lines'}
            title={wrap ? 'Disable line wrapping' : 'Wrap long lines'}
          >
            <WrapText aria-hidden />
          </button>
          <button
            type="button"
            className="md-code-button"
            onClick={onCopy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            title={copied ? 'Copied' : 'Copy code'}
            data-copied={copied || undefined}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            <span className="md-code-button-text">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="md-code-body" tabIndex={0}>
        <code>
          {lines
            ? lines.map((line, i) => <CodeLine key={i} line={line} />)
            : plainLines!.map((text, i) => <PlainLine key={i} text={text} />)}
        </code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Code copied to clipboard' : ''}
      </span>
    </div>
  )
})
