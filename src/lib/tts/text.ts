/**
 * Turns a chat message (markdown) into text that sounds right when spoken, and
 * splits it into chunks small enough to synthesize quickly.
 *
 * Code is never read symbol by symbol: fenced blocks become a short spoken
 * note, long inline code is summarised, and math is described rather than read.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cs: 'C sharp',
  csharp: 'C sharp',
  php: 'PHP',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'CSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  dockerfile: 'Dockerfile',
}

const codeBlockNote = (lang: string) => {
  const name = LANGUAGE_NAMES[lang.toLowerCase()]
  return name ? ` (There's a ${name} code block here.) ` : " (There's a code block here.) "
}

/** Ends a line with a full stop when it has no punctuation, so the voice pauses. */
const endSentence = (line: string) => (/[.!?:;,…)]$/.test(line) ? line : `${line}.`)

export function markdownToSpeech(markdown: string): string {
  let text = markdown.replace(/\r\n?/g, '\n')

  // Hidden reasoning, if any ever reaches us
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ' ')

  // Fenced code blocks (``` or ~~~), including an unterminated one at the end
  text = text.replace(
    /(^|\n)[ \t]*(`{3,}|~{3,})[ \t]*([\w+#.-]*)[^\n]*\n[\s\S]*?(?:\n[ \t]*\2[ \t]*(?=\n|$)|$)/g,
    (_m, pre, _f, lang) => `${pre}${codeBlockNote(lang || '')}\n`,
  )

  // Display and inline math
  text = text.replace(/\$\$[\s\S]+?\$\$/g, ' (an equation) ')
  text = text.replace(/\\\[[\s\S]+?\\\]/g, ' (an equation) ')
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, expr: string) => (expr.length <= 12 ? expr : ' (an expression) '))
  text = text.replace(
    /(^|[^\\$])\$([^$\n]{1,80}?)\$/g,
    (_m, pre, expr: string) =>
      `${pre}${expr.length <= 12 ? expr.replace(/\^/g, ' to the power ').replace(/[\\{}_]/g, ' ') : '(an expression)'}`,
  )

  // Inline code: identifiers, file names and short commands read fine; symbol-heavy snippets don't
  text = text.replace(/`+([^`\n]+)`+/g, (_m, code: string) => {
    const trimmed = code.trim()
    return trimmed.length <= 32 && /^[\w.\-/@ ]+(\(\))?$/.test(trimmed) ? trimmed : 'a code snippet'
  })

  // Images, links, bare URLs, HTML
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => (alt ? ` (image: ${alt}) ` : ' '))
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
  text = text.replace(/<https?:\/\/[^>]+>/g, 'a link')
  text = text.replace(/\bhttps?:\/\/[^\s)]+/g, 'a link')
  text = text.replace(/<\/?[a-z][^>]*>/gi, ' ')

  const lines = text.split('\n').map((rawLine) => {
    let line = rawLine.trim()
    if (!line) return ''

    // Table separator rows: | --- | :---: |
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line)) return ''
    // Horizontal rules
    if (/^([-*_])(\s*\1){2,}$/.test(line)) return ''

    // Table rows become comma-separated cells
    if (/^\|.*\|$/.test(line)) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
      return cells.length ? endSentence(cells.join(', ')) : ''
    }

    line = line.replace(/^>+\s?/, '') // blockquotes
    const isHeading = /^#{1,6}\s+/.test(line)
    line = line.replace(/^#{1,6}\s+/, '')
    const isListItem = /^([-*+]|\d+[.)])\s+/.test(line)
    line = line.replace(/^([-*+]|\d+[.)])\s+/, '')
    line = line.replace(/^\[[ xX]\]\s+/, '') // task list boxes

    return isHeading || isListItem ? endSentence(line) : line
  })

  text = lines.join('\n')

  // Emphasis, strikethrough, footnote refs
  text = text.replace(/(\*\*|__)(.+?)\1/g, '$2')
  text = text.replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?=[^\w*]|$)/g, '$1$2')
  text = text.replace(/~~(.+?)~~/g, '$1')
  text = text.replace(/\[\^[^\]]+\]/g, '')

  // Symbols that voices tend to read out literally
  text = text.replace(/\s->\s/g, ' to ').replace(/\s=>\s/g, ' gives ')
  text = text.replace(/[*#|_~`]+/g, ' ')

  // Paragraph breaks become sentence breaks; collapse whitespace
  text = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(endSentence)
    .join('\n\n')
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\.{2}(?!\.)/g, '.')

  return text.trim()
}

/** Splits text into sentences, keeping the punctuation. */
function splitSentences(text: string): string[] {
  const out: string[] = []
  for (const paragraph of text.split(/\n{2,}/)) {
    // Split only where punctuation is followed by whitespace, so "list.reverse()" stays whole
    const parts = paragraph.split(/(?<=[.!?…]["')\]]*)\s+/)
    let buffer = ''
    for (const part of parts) {
      buffer = buffer ? `${buffer} ${part}` : part
      // Don't split after common abbreviations or single initials ("e.g.", "Dr.", "J.")
      if (/\b(e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|No|[A-Z])\.\s*$/.test(buffer)) continue
      if (buffer.trim()) out.push(buffer.trim())
      buffer = ''
    }
    if (buffer.trim()) out.push(buffer.trim())
  }
  return out
}

/** Hard-wraps an over-long sentence at commas or spaces. Every piece is at most `max` characters. */
function wrap(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence]
  const out: string[] = []
  let rest = sentence
  while (rest.length > max) {
    const window = rest.slice(0, max)
    let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '))
    if (cut < max * 0.4) cut = window.lastIndexOf(' ')
    // Keep the punctuation mark (cut + 1 <= max, since the window is max long);
    // with no break at all, cut the unbroken run exactly at max.
    const end = cut > 0 ? cut + 1 : max
    out.push(rest.slice(0, end).trim())
    rest = rest.slice(end).trim()
  }
  if (rest) out.push(rest)
  return out
}

/**
 * Groups sentences into chunks. The first chunk is kept short so playback
 * starts quickly; later chunks are larger so the voice flows naturally.
 */
export function chunkForSpeech(text: string, { first = 160, rest = 360 }: { first?: number; rest?: number } = {}) {
  const sentences = splitSentences(text).flatMap((s) => wrap(s, rest))
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const limit = chunks.length === 0 ? first : rest
    if (current && current.length + sentence.length + 1 > limit) {
      chunks.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) chunks.push(current)
  return chunks
}
