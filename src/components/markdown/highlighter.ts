'use client'

/**
 * Syntax highlighting for chat code blocks.
 *
 * - Shiki core with the JavaScript regex engine (no WASM download).
 * - Each language grammar is its own lazily loaded chunk, fetched the first
 *   time a block in that language appears.
 * - The theme has no real colours. Like Feather's viewer, every scope maps to
 *   one of a few token classes, and CSS colours those classes from theme
 *   tokens (see markdown.css). Light, dark and custom themes then need no
 *   re-highlighting.
 * - Tokenizing is synchronous once the grammar is loaded, and it is
 *   incremental for streaming: complete lines are tokenized once and the
 *   grammar state is carried forward, so a growing block costs only the new
 *   lines per update.
 */

import type { GrammarState, HighlighterCore, ThemeRegistrationRaw } from 'shiki/core'

export const TOKEN_CLASSES = [
  'text',
  'comment',
  'punctuation',
  'keyword',
  'string',
  'number',
  'escape',
  'function',
  'type',
  'tag',
] as const

export type TokenClass = (typeof TOKEN_CLASSES)[number]

/** A run of text and its token class index (0 = plain text). */
export type Token = { content: string; cls: number; italic?: boolean }
export type Line = Token[]

// The "colour" of each class is a marker: #0000NN, where NN is the class index.
const marker = (cls: number) => `#0000${cls.toString(16).padStart(2, '0')}`

// Scope rules, adapted from Feather's syntax theme.
const RULES: [string[], TokenClass][] = [
  [['comment', 'punctuation.definition.comment', 'string.quoted.docstring.multi'], 'comment'],
  [['punctuation', 'meta.brace', 'keyword.operator'], 'punctuation'],
  [['keyword', 'storage', 'keyword.operator.word', 'keyword.operator.new', 'keyword.operator.expression'], 'keyword'],
  [
    ['string', 'punctuation.definition.string', 'markup.raw', 'markup.inserted', 'markup.quote', 'markup.inline.raw'],
    'string',
  ],
  [
    [
      'constant.numeric',
      'constant.language',
      'constant.other',
      'support.constant',
      'variable.other.constant',
      'string.regexp',
      'entity.other.attribute-name',
      'variable.language',
      'variable.parameter.option',
    ],
    'number',
  ],
  [
    [
      'constant.character.escape',
      'constant.other.placeholder',
      'markup.bold',
      'markup.italic',
      'markup.underline.link',
      'variable.annotation',
      'meta.annotation',
      'entity.name.label',
      'punctuation.definition.template-expression',
    ],
    'escape',
  ],
  [
    [
      'entity.name.function',
      'support.function',
      'variable.function',
      'meta.function-call',
      'markup.heading',
      'entity.name.section',
      'meta.mapping.key string',
      'support.type.property-name',
      'meta.property-name',
      'entity.name.tag.yaml',
      'entity.name.tag.toml',
      'meta.tag.key',
    ],
    'function',
  ],
  [
    [
      'entity.name.type',
      'entity.name.class',
      'entity.name.struct',
      'entity.name.enum',
      'entity.name.trait',
      'entity.name.namespace',
      'support.type',
      'support.class',
      'entity.other.inherited-class',
    ],
    'type',
  ],
  [['entity.name.tag', 'markup.deleted', 'invalid'], 'tag'],
]

const THEME: ThemeRegistrationRaw = {
  name: 't2chat-tokens',
  type: 'dark',
  settings: [
    { settings: { foreground: marker(0), background: '#000000' } },
    ...RULES.map(([scope, cls]) => ({
      scope,
      settings: { foreground: marker(TOKEN_CLASSES.indexOf(cls)) },
    })),
    { scope: ['comment', 'markup.italic'], settings: { fontStyle: 'italic' } },
  ],
  fg: marker(0),
  bg: '#000000',
}

// ---------------------------------------------------------------------------
// Language resolution

/** Common fence labels that Shiki doesn't know under that name. */
const EXTRA_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  console: 'shellsession',
  shellscript: 'bash',
  zsh: 'bash',
  sh: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  py3: 'python',
  python3: 'python',
  'objective-c': 'objc',
  node: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  dockerfile: 'docker',
  env: 'dotenv',
  conf: 'ini',
  cfg: 'ini',
  yml: 'yaml',
  md: 'markdown',
  htm: 'html',
  svg: 'xml',
  plist: 'xml',
  gql: 'graphql',
  tf: 'hcl',
}

const PLAIN = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'none', 'output', 'log', 'ansi'])

/** Display names for the language label. */
const LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  bash: 'Bash',
  shellsession: 'Console',
  powershell: 'PowerShell',
  json: 'JSON',
  jsonc: 'JSONC',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  yaml: 'YAML',
  toml: 'TOML',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  fsharp: 'F#',
  php: 'PHP',
  ruby: 'Ruby',
  markdown: 'Markdown',
  graphql: 'GraphQL',
  docker: 'Dockerfile',
  xml: 'XML',
  diff: 'Diff',
  lua: 'Lua',
  dart: 'Dart',
  r: 'R',
  objc: 'Objective-C',
  latex: 'LaTeX',
  tex: 'TeX',
  vue: 'Vue',
  svelte: 'Svelte',
  hcl: 'HCL',
  dotenv: '.env',
  ini: 'INI',
  regex: 'Regex',
  zig: 'Zig',
  elixir: 'Elixir',
  haskell: 'Haskell',
  scala: 'Scala',
  nginx: 'Nginx',
  prisma: 'Prisma',
  solidity: 'Solidity',
  text: 'Text',
}

type LangLoaders = Record<string, () => Promise<unknown>>
let langLoaders: LangLoaders | null = null
let langLoadersPromise: Promise<LangLoaders> | null = null

function loadLangLoaders(): Promise<LangLoaders> {
  if (!langLoadersPromise) {
    // The index itself is tiny. Each entry is a dynamic import, a separate chunk.
    langLoadersPromise = import('shiki/langs').then((m) => {
      langLoaders = m.bundledLanguages as unknown as LangLoaders
      return langLoaders
    })
  }
  return langLoadersPromise
}

/** Normalizes a fence info string (`ts`, `TypeScript`, `py {1,3}`) to a language id. */
export function normalizeLang(raw: string | undefined): string {
  const id = (raw ?? '').trim().split(/[\s{]/)[0].toLowerCase()
  if (PLAIN.has(id)) return 'text'
  return EXTRA_ALIASES[id] ?? id
}

/** Short fence names Shiki resolves itself, mapped to their label key. */
const LABEL_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  cs: 'csharp',
  kt: 'kotlin',
  kts: 'kotlin',
  'c++': 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  jsonl: 'json',
  json5: 'json',
}

export function langLabel(raw: string | undefined): string {
  const normalized = normalizeLang(raw)
  const id = LABEL_ALIASES[normalized] ?? normalized
  if (LABELS[id]) return LABELS[id]
  const original = (raw ?? '').trim().split(/[\s{]/)[0]
  return original || 'Text'
}

// ---------------------------------------------------------------------------
// Highlighter singleton + per-language readiness store

let highlighter: HighlighterCore | null = null
let highlighterPromise: Promise<HighlighterCore> | null = null
const ready = new Set<string>()
const failed = new Set<string>()
const pending = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getVersion() {
  return version
}

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(
      async ([core, engine]) => {
        const h = await core.createHighlighterCore({
          themes: [THEME],
          langs: [],
          engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
        })
        highlighter = h
        return h
      },
    )
  }
  return highlighterPromise
}

/** Starts loading the grammar for `lang`. Subscribers are notified when it's ready. */
export function ensureLang(lang: string): void {
  if (lang === 'text' || ready.has(lang) || failed.has(lang) || pending.has(lang)) return
  const p = Promise.all([getHighlighter(), loadLangLoaders()])
    .then(async ([h, loaders]) => {
      const loader = loaders[lang]
      if (!loader) {
        failed.add(lang)
        return
      }
      await h.loadLanguage(loader as Parameters<HighlighterCore['loadLanguage']>[0])
      ready.add(lang)
    })
    .catch(() => {
      failed.add(lang)
    })
    .finally(() => {
      pending.delete(lang)
      emit()
    })
  pending.set(lang, p)
}

/** True once `lang` can be tokenized synchronously. */
export function isLangReady(lang: string): boolean {
  return highlighter !== null && ready.has(lang)
}

// ---------------------------------------------------------------------------
// Tokenizing

// A line longer than this is shown as plain text. Huge minified lines are slow
// to tokenize and are unreadable highlighted anyway.
const MAX_LINE_LENGTH = 2000

function convert(lines: { content: string; color?: string; fontStyle?: number }[][]): Line[] {
  return lines.map((line) =>
    line.map((t) => {
      const cls = t.color ? parseInt(t.color.slice(-2), 16) || 0 : 0
      // FontStyle.Italic === 1
      return { content: t.content, cls: cls < TOKEN_CLASSES.length ? cls : 0, italic: !!(t.fontStyle && t.fontStyle & 1) }
    }),
  )
}

function tokenize(code: string, lang: string, grammarState?: GrammarState) {
  const h = highlighter!
  const result = h.codeToTokens(code, {
    lang,
    theme: THEME.name!,
    grammarState,
    tokenizeMaxLineLength: MAX_LINE_LENGTH,
  })
  return { lines: convert(result.tokens), state: result.grammarState }
}

/**
 * Incremental tokenizer for one code block. Feed it the full code each time.
 * If the code only grew (streaming), only the new lines are tokenized.
 */
export class IncrementalTokenizer {
  private lang: string
  private committed = '' // text up to and including the last '\n' already tokenized
  private lines: Line[] = []
  private state: GrammarState | undefined

  constructor(lang: string) {
    this.lang = lang
  }

  tokenize(code: string): Line[] {
    if (!code.startsWith(this.committed)) {
      this.committed = ''
      this.lines = []
      this.state = undefined
    }
    const lastNl = code.lastIndexOf('\n')
    if (lastNl + 1 > this.committed.length) {
      // Commit newly completed lines.
      const chunk = code.slice(this.committed.length, lastNl)
      const { lines, state } = tokenize(chunk, this.lang, this.state)
      this.lines.push(...lines)
      this.state = state
      this.committed = code.slice(0, lastNl + 1)
    }
    const tail = code.slice(this.committed.length)
    if (!tail) return this.committed ? [...this.lines, []] : this.lines
    // The trailing partial line is tokenized but not committed.
    const { lines } = tokenize(tail, this.lang, this.state)
    return [...this.lines, ...lines]
  }
}

// Finished blocks are cached, so remounts and re-renders reuse the work.
const CACHE_LIMIT = 200
const cache = new Map<string, Line[]>()

export function tokenizeCached(code: string, lang: string): Line[] {
  const key = `${lang}\u0000${code}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const { lines } = tokenize(code, lang)
  cache.set(key, lines)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  return lines
}
