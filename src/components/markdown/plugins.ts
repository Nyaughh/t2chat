/**
 * Remark plugins and source transforms for chat markdown.
 *
 * Source transforms (math delimiters, streaming repair) work on raw text, but
 * they never touch code, links or HTML: a real CommonMark parse
 * (mdast-util-from-markdown) finds those regions first, so containers
 * (blockquotes, lists), indented code and multi-backtick spans are all
 * handled correctly.
 */

import { fromMarkdown } from 'mdast-util-from-markdown'

type MdNode = {
  type: string
  value?: string
  children?: MdNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
  data?: { hName?: string; hProperties?: Record<string, unknown>; hChildren?: unknown[] }
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Protected regions

type Range = [number, number]

const CODE_KINDS = new Set(['code', 'inlineCode', 'html'])
const LINK_KINDS = new Set(['link', 'image', 'linkReference', 'imageReference', 'definition'])

/** Source ranges of code, HTML, links and definitions, sorted by start. */
function protectedRanges(md: string): Range[] {
  const ranges: Range[] = []
  let tree: MdNode
  try {
    tree = fromMarkdown(md) as unknown as MdNode
  } catch {
    return [[0, md.length]]
  }
  const walk = (node: MdNode) => {
    if (CODE_KINDS.has(node.type) || LINK_KINDS.has(node.type)) {
      const s = node.position?.start.offset
      const e = node.position?.end.offset
      if (s !== undefined && e !== undefined) ranges.push([s, e])
      return
    }
    node.children?.forEach(walk)
  }
  walk(tree)
  return ranges.sort((a, b) => a[0] - b[0])
}


/** `md` with every protected character replaced by a space (same length). */
function maskProtected(md: string, ranges: Range[]): string {
  if (!ranges.length) return md
  let out = ''
  let pos = 0
  for (const [s, e] of ranges) {
    if (e <= pos) continue
    out += md.slice(pos, Math.max(pos, s)) + ' '.repeat(e - Math.max(pos, s))
    pos = e
  }
  return out + md.slice(pos)
}

// ---------------------------------------------------------------------------
// Math delimiters

const LINE_PREFIX = /^[ \t>]*/
const DISPLAY_MATH = /(^|\n)([ \t>]*)\\\[([\s\S]+?)\\\][ \t]*(?=\n|$)/g
const INLINE_MATH = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g

/** Rewrites `\[ \]` and `\( \)` in one prose segment (no code, links or HTML inside). */
function convertSegment(text: string, startsLine: boolean): string {
  const display = text.replace(DISPLAY_MATH, (m, pre: string, prefix: string, body: string, offset: number) => {
    // A segment that starts mid-line (after a code span, say) has no line start there.
    if (offset === 0 && !pre && !startsLine) return m
    const lines = body.split('\n').map((l) => l.replace(LINE_PREFIX, '').trimEnd())
    while (lines.length && !lines[0]) lines.shift()
    while (lines.length && !lines[lines.length - 1]) lines.pop()
    return `${pre}${prefix}$$\n${lines.map((l) => prefix + l).join('\n')}\n${prefix}$$`
  })
  // One pass for both inline forms, so matches never overlap.
  return display.replace(INLINE_MATH, (_m, block: string | undefined, inline: string | undefined) =>
    block !== undefined ? `$$${block.trim()}$$` : `$${(inline ?? '').trim()}$`,
  )
}

/**
 * Models often write LaTeX with `\( \)` and `\[ \]`. remark-math only knows
 * `$`, so convert. The source is cut at code, link and HTML boundaries (from
 * a CommonMark parse) and only the prose segments between them are
 * rewritten, each on its own: offsets never drift, and a delimiter pair can
 * never reach into code. `\[ \]` on its own lines (also inside a blockquote
 * or list) becomes a `$$` block.
 */
export function normalizeMathDelimiters(md: string): string {
  if (!md.includes('\\(') && !md.includes('\\[')) return md
  const ranges = protectedRanges(md)
  let out = ''
  let pos = 0
  const prose = (end: number) => {
    if (end > pos) out += convertSegment(md.slice(pos, end), pos === 0 || md[pos - 1] === '\n')
  }
  for (const [s, e] of ranges) {
    if (e <= pos) continue
    prose(s)
    out += md.slice(Math.max(pos, s), e)
    pos = e
  }
  prose(md.length)
  return out
}

// ---------------------------------------------------------------------------
// Streaming repair

const FENCE_OPEN = /^[ \t>]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?[ \t>]*(`{3,}|~{3,})/
const FENCE_CLOSE = /^[ \t>]*(`{3,}|~{3,})[ \t]*$/

/** True if `md` ends inside a fenced code block (also inside quotes and lists). */
export function endsInsideFence(md: string): boolean {
  let fence: string | null = null
  for (const line of md.split('\n')) {
    if (fence) {
      const m = FENCE_CLOSE.exec(line)
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null
    } else {
      const m = FENCE_OPEN.exec(line)
      // A backtick fence's info string can't contain a backtick.
      if (m && !(m[1][0] === '`' && line.slice(line.indexOf(m[1]) + m[1].length).includes('`'))) fence = m[1]
    }
  }
  return fence !== null
}

/**
 * Closes markdown that's cut off mid-stream so the last block doesn't flash
 * raw syntax: an unclosed `**bold`, `~~strike` or `` `code `` gets its
 * closing marker, and a half-written link or image shows only its text.
 * Complete code spans, links and images are never modified.
 * Only used on the block that's still streaming.
 */
export function repairStreamingTail(block: string): string {
  if (!/[`*~[]/.test(block) || endsInsideFence(block)) return block

  const ranges = protectedRanges(block)
  const openFrom = ranges.reduce((max, [, e]) => Math.max(max, e), 0)
  const head = block.slice(0, openFrom)
  let tail = block.slice(openFrom)
  let close = ''

  // An unmatched backtick run in the open tail, with no line break after it:
  // the rest of the line is an unfinished code span.
  const code = /(`+)[^\n]*$/.exec(tail)
  let codeStart = -1
  if (code) {
    codeStart = openFrom + code.index
    close = code[1]
  } else {
    // A half-written link or image: `[text](https://exa` → `text`
    const link = /!?\[([^\]\n]*)\]\([^)\s]*$/.exec(tail)
    if (link) {
      tail = tail.slice(0, link.index) + link[1]
    } else {
      // An opening bracket with no `]` yet: drop the bracket.
      const bracket = /!?\[([^\]\n]*)$/.exec(tail)
      if (bracket) tail = tail.slice(0, bracket.index) + bracket[1]
    }
  }

  // Emphasis markers, counted outside code, links and the open code span.
  const counted = maskProtected(codeStart >= 0 ? block.slice(0, codeStart) : head + tail, ranges)
  const text = head + tail
  const open: { marker: string; at: number }[] = []
  for (const marker of ['**', '~~']) {
    const count = counted.split(marker).length - 1
    if (count % 2 === 1 && !text.trimEnd().endsWith(marker)) open.push({ marker, at: counted.lastIndexOf(marker) })
  }
  // Innermost first: the code span, then whichever marker opened last.
  open.sort((a, b) => b.at - a.at)
  return text + close + open.map((o) => o.marker).join('')
}

// ---------------------------------------------------------------------------
// Remark plugins (they run on the mdast, so code is never affected)

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n)?/i

/**
 * GitHub-style alerts (`> [!NOTE]`, Feather renders these too). The
 * blockquote gets `data-alert="note"` and the marker text is removed.
 */
export function remarkAlerts() {
  return (tree: MdNode) => {
    const walk = (node: MdNode) => {
      if (node.type === 'blockquote') {
        const para = node.children?.[0]
        const first = para?.type === 'paragraph' ? para.children?.[0] : undefined
        if (first?.type === 'text' && first.value) {
          const m = ALERT_RE.exec(first.value)
          if (m) {
            first.value = first.value.slice(m[0].length)
            if (!first.value && para!.children!.length > 1 && para!.children![1].type === 'break') {
              para!.children!.splice(0, 2)
            } else if (!first.value) {
              para!.children!.shift()
            }
            if (para!.children!.length === 0) node.children!.shift()
            node.data = {
              ...node.data,
              hProperties: { ...(node.data?.hProperties ?? {}), dataAlert: m[1].toLowerCase() },
            }
          }
        }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

const BR_RE = /^<br\s*\/?>$/i
const BLOCK_PARENTS = new Set(['root', 'blockquote', 'listItem', 'footnoteDefinition'])

/**
 * Model output is untrusted, so raw HTML is never rendered as HTML. Rather
 * than silently dropping it (react-markdown's default), show it as literal
 * text. The exception is `<br>`, which models often use inside table cells;
 * it becomes a line break.
 */
export function remarkHtmlAsText() {
  return (tree: MdNode) => {
    const walk = (node: MdNode) => {
      const children = node.children
      if (!children) return
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.type === 'html') {
          const value = child.value ?? ''
          if (BR_RE.test(value.trim())) {
            children[i] = { type: 'break' }
          } else if (BLOCK_PARENTS.has(node.type)) {
            children[i] = { type: 'paragraph', children: [{ type: 'text', value }] }
          } else {
            children[i] = { type: 'text', value }
          }
        } else {
          walk(child)
        }
      }
    }
    walk(tree)
  }
}

/**
 * Message-level footnotes. Each block is rendered with placeholder
 * definitions for the labels it references (see analyze.ts), so remark-gfm
 * parses real `footnoteReference` nodes; code and escaped brackets never
 * become references. This plugin replaces each reference with a
 * `sup > a[data-fn-id]` (the link component fills in the scoped href and the
 * message-level number) and drops the placeholder definitions, so no
 * per-block footnote section is generated. The first reference to an id in
 * this block gets `data-fn-first`.
 */
export function remarkFootnoteRefs() {
  return (tree: MdNode) => {
    const seen = new Set<string>()
    const walk = (node: MdNode) => {
      const children = node.children
      if (!children) return
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.type === 'footnoteDefinition') {
          children.splice(i, 1)
          i--
        } else if (child.type === 'footnoteReference') {
          const id = String(child.identifier ?? '')
          const first = !seen.has(id)
          seen.add(id)
          children[i] = {
            type: 'footnoteRefMark',
            data: {
              hName: 'sup',
              hProperties: { className: ['md-fnref'] },
              hChildren: [
                {
                  type: 'element',
                  tagName: 'a',
                  properties: { href: '#', dataFnId: id, dataFnFirst: first ? 'true' : undefined },
                  children: [{ type: 'text', value: id }],
                },
              ],
            },
          }
        } else {
          walk(child)
        }
      }
    }
    walk(tree)
  }
}
