import { marked, type Token, type Tokens } from 'marked'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote'
import { gfmFootnote } from 'micromark-extension-gfm-footnote'
import { endsInsideFence } from './plugins'

// ---------------------------------------------------------------------------
// Analysis: blocks, reference definitions, footnotes
//
// The message is split into top-level blocks, each rendered and memoized on
// its own. While streaming, only the last block changes, so earlier blocks
// (and their highlighted code and KaTeX) are never re-rendered.
//
// Messages without reference syntax take a fast path (marked's lexer).
// Messages with `[^` or `]:` are parsed with a CommonMark + GFM-footnote
// parser instead, and every cross-reference decision comes from parsed
// nodes, so nothing inside code counts:
// - a block gets an exact source copy of only the link definitions its
//   parsed references use (definitions render nothing);
// - footnotes are numbered and listed once per message; a block gets
//   placeholder definitions only for the footnotes it references, which
//   remarkFootnoteRefs turns into message-scoped references;
// - nothing is ever appended to a block that ends inside an open fence or
//   open display math, so it can't become visible source.

export type BlockInfo = {
  content: string
  /** Top-level node type when the block is a single node, else 'mixed'. */
  kind: string
  /** Contains `$`, `\(`/`\[` in prose, or a `math` code fence (any fence form). */
  math: boolean
}

export type Footnote = { id: string; content: string }

export type Analysis = {
  blocks: BlockInfo[]
  footnotes: Footnote[]
  numbers: Record<string, number>
  firstBlock: Record<string, number>
}

type Segment = {
  start: number
  end: number
  content: string
  /** Source with code removed: what display-math delimiters are counted in. */
  prose: string
  kind: string
  mathFence: boolean
  refs: string[]
  fnRefs: string[]
}

const MATH_IN_PROSE = /\$|\\\(|\\\[/
const REFERENCE_SYNTAX = /\[\^|\]:/

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

/** True if display math (`$$` or `\[`) is still open at the end of `prose`. */
function displayMathOpen(prose: string) {
  return count(prose, /\$\$/g) % 2 === 1 || count(prose, /\\\[/g) > count(prose, /\\\]/g)
}

/** Merges segments into blocks; an open display-math block absorbs what follows. */
function mergeSegments(segments: Segment[], join: (from: Segment, to: Segment, parts: Segment[]) => string) {
  const groups: Segment[][] = []
  let group: Segment[] = []
  let prose = ''
  for (const seg of segments) {
    if (!group.length && !seg.content.trim()) continue
    group.push(seg)
    prose += seg.prose
    if (displayMathOpen(prose)) continue
    groups.push(group)
    group = []
    prose = ''
  }
  if (group.length) groups.push(group)
  return groups.map((parts) => {
    const content = join(parts[0], parts[parts.length - 1], parts)
    const prose = parts.map((p) => p.prose).join('')
    return {
      content,
      prose,
      kind: parts.length === 1 ? parts[0].kind : 'mixed',
      math: MATH_IN_PROSE.test(prose) || parts.some((p) => p.mathFence),
      refs: parts.flatMap((p) => p.refs),
      fnRefs: parts.flatMap((p) => p.fnRefs),
    }
  })
}

// ---------------------------------------------------------------------------
// Fast path: marked

const CODE_TOKENS = new Set(['code', 'codespan', 'html'])

function collectCode(token: unknown, out: string[]) {
  if (!token || typeof token !== 'object') return
  const t = token as { type?: string; raw?: string; [k: string]: unknown }
  if (t.type && CODE_TOKENS.has(t.type) && t.raw) {
    out.push(t.raw)
    return
  }
  for (const key of ['tokens', 'items', 'header', 'rows']) {
    const v = t[key]
    if (Array.isArray(v)) v.forEach((x) => (Array.isArray(x) ? x.forEach((y) => collectCode(y, out)) : collectCode(x, out)))
  }
}

/** The token's source with code spans, code blocks and HTML blanked out. */
function proseOf(token: Token): string {
  if (token.type === 'code') return ''
  const code: string[] = []
  collectCode(token, code)
  let prose = token.raw
  let from = 0
  for (const raw of code) {
    const at = prose.indexOf(raw, from)
    if (at < 0) continue
    prose = prose.slice(0, at) + ' '.repeat(raw.length) + prose.slice(at + raw.length)
    from = at + raw.length
  }
  return prose
}

function hasMathFence(tokens: Token[] | undefined): boolean {
  if (!tokens) return false
  for (const t of tokens) {
    if (t.type === 'code' && ((t as Tokens.Code).lang ?? '').trim().split(/\s/)[0] === 'math') return true
    const nested = t as { tokens?: Token[]; items?: Tokens.ListItem[] }
    if (hasMathFence(nested.tokens)) return true
    if (nested.items?.some((item) => hasMathFence(item.tokens))) return true
  }
  return false
}

function analyzeFast(md: string): Analysis {
  let tokens: Token[]
  try {
    tokens = marked.lexer(md, { gfm: true })
  } catch {
    return { blocks: [{ content: md, kind: 'mixed', math: MATH_IN_PROSE.test(md) }], footnotes: [], numbers: {}, firstBlock: {} }
  }
  const segments: Segment[] = tokens.map((token) => ({
    start: 0,
    end: 0,
    content: token.raw,
    prose: proseOf(token),
    kind: token.type,
    mathFence: hasMathFence([token]),
    refs: [],
    fnRefs: [],
  }))
  const blocks = mergeSegments(segments, (_a, _b, parts) => parts.map((p) => p.content).join('')).map(
    ({ content, kind, math }) => ({ content, kind, math }),
  )
  return { blocks, footnotes: [], numbers: {}, firstBlock: {} }
}

// ---------------------------------------------------------------------------
// Reference path: parsed mdast

type MdNode = {
  type: string
  identifier?: string
  lang?: string | null
  children?: MdNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

const offsets = (n: MdNode): [number, number] => [n.position?.start.offset ?? 0, n.position?.end.offset ?? 0]

/** Code, math fences and references inside `node` (never descending into footnote definitions). */
function scan(node: MdNode, out: { code: [number, number][]; mathFence: boolean; refs: string[]; fnRefs: string[] }) {
  for (const child of node.children ?? []) {
    if (child.type === 'code' || child.type === 'inlineCode' || child.type === 'html') {
      out.code.push(offsets(child))
      if (child.type === 'code' && (child.lang ?? '') === 'math') out.mathFence = true
      continue
    }
    if (child.type === 'footnoteDefinition') continue
    if ((child.type === 'linkReference' || child.type === 'imageReference') && child.identifier) out.refs.push(child.identifier)
    if (child.type === 'footnoteReference' && child.identifier) out.fnRefs.push(child.identifier)
    scan(child, out)
  }
}

function dedentFootnoteBody(text: string) {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : line.replace(/^ {1,4}/, '')))
    .join('\n')
    .trim()
}

function analyzeReferences(md: string): Analysis {
  let tree: MdNode
  try {
    tree = fromMarkdown(md, { extensions: [gfmFootnote()], mdastExtensions: [gfmFootnoteFromMarkdown()] }) as MdNode
  } catch {
    return analyzeFast(md)
  }

  // Definitions anywhere in the document (first one wins, as in CommonMark).
  const linkDefs = new Map<string, string>()
  const footnoteNodes = new Map<string, MdNode>()
  const collect = (node: MdNode) => {
    for (const child of node.children ?? []) {
      if (child.type === 'code' || child.type === 'inlineCode' || child.type === 'html') continue
      if (child.type === 'definition' && child.identifier && !linkDefs.has(child.identifier)) {
        const [s, e] = offsets(child)
        linkDefs.set(child.identifier, md.slice(s, e).replace(/^[ \t>]+/gm, ''))
      }
      if (child.type === 'footnoteDefinition' && child.identifier && !footnoteNodes.has(child.identifier)) {
        footnoteNodes.set(child.identifier, child)
      }
      collect(child)
    }
  }
  collect(tree)

  const segmentOf = (node: MdNode): Segment => {
    const [start, end] = offsets(node)
    const found = { code: [] as [number, number][], mathFence: false, refs: [] as string[], fnRefs: [] as string[] }
    if (node.type === 'code' || node.type === 'html') {
      found.code.push([start, end])
      if (node.type === 'code' && (node.lang ?? '') === 'math') found.mathFence = true
    } else {
      scan(node, found)
    }
    let prose = md.slice(start, end)
    for (const [s, e] of found.code) {
      prose = prose.slice(0, s - start) + ' '.repeat(e - s) + prose.slice(e - start)
    }
    return { start, end, content: md.slice(start, end), prose, kind: node.type, mathFence: found.mathFence, refs: found.refs, fnRefs: found.fnRefs }
  }

  const segments = (tree.children ?? [])
    .filter((n) => n.type !== 'definition' && n.type !== 'footnoteDefinition')
    .map(segmentOf)

  /** Appends the definitions a block needs, unless it ends inside an open construct. */
  const withDefinitions = (content: string, prose: string, refs: string[], fnRefs: string[]) => {
    if (endsInsideFence(content) || displayMathOpen(prose)) return content
    const lines: string[] = []
    for (const id of new Set(refs)) if (linkDefs.has(id)) lines.push(linkDefs.get(id)!)
    for (const id of new Set(fnRefs)) if (footnoteNodes.has(id)) lines.push(`[^${id}]: -`)
    return lines.length ? `${content.replace(/\s+$/, '')}\n\n${lines.join('\n')}\n` : content
  }

  const merged = mergeSegments(segments, (a, b) => md.slice(a.start, b.end))
  const blocks: BlockInfo[] = merged.map((m) => ({
    content: withDefinitions(m.content, m.prose, m.refs, m.fnRefs),
    kind: m.kind,
    math: m.math,
  }))

  // Footnote numbers follow the order of first (parsed) reference.
  const numbers: Record<string, number> = {}
  const firstBlock: Record<string, number> = {}
  let n = 0
  merged.forEach((m, i) => {
    for (const id of m.fnRefs) {
      if (footnoteNodes.has(id) && !numbers[id]) {
        numbers[id] = ++n
        firstBlock[id] = i
      }
    }
  })
  for (const id of footnoteNodes.keys()) if (!numbers[id]) numbers[id] = ++n

  const footnotes: Footnote[] = [...footnoteNodes.entries()]
    .map(([id, node]) => {
      const kids = node.children ?? []
      if (!kids.length) return { id, content: '' }
      const body = dedentFootnoteBody(md.slice(offsets(kids[0])[0], offsets(kids[kids.length - 1])[1]))
      const found = { code: [] as [number, number][], mathFence: false, refs: [] as string[], fnRefs: [] as string[] }
      scan(node, found)
      return { id, content: withDefinitions(body, body, found.refs, found.fnRefs) }
    })
    .sort((a, b) => numbers[a.id] - numbers[b.id])

  return { blocks, footnotes, numbers, firstBlock }
}

export function analyze(md: string): Analysis {
  if (!md.trim()) return { blocks: [], footnotes: [], numbers: {}, firstBlock: {} }
  return REFERENCE_SYNTAX.test(md) ? analyzeReferences(md) : analyzeFast(md)
}
