/**
 * Importing themes, modelled on Feather's importer (src/themes.rs).
 *
 * Accepted input (all untrusted):
 * - The CSS that tweakcn.com and shadcn/ui produce: a `:root { --background: … }`
 *   block for light and a `.dark { … }` block for dark, optionally wrapped in
 *   `@layer base { … }`. Either half may be missing.
 * - Bare `--name: value;` declarations with no selector (treated as one half).
 * - A shadcn registry item / tweakcn JSON export: `{ "cssVars": { "light": {…}, "dark": {…} } }`.
 *
 * Colors may be oklch(), hsl(), bare `H S% L%`, rgb() or #hex. Only the tokens in
 * tokens.ts are read; every value is re-serialized to `#rrggbb[aa]`, so nothing
 * from the input ever reaches CSS as written. Missing tokens are derived, and
 * text colors are nudged until they are readable against their backgrounds.
 */

import {
  BLACK,
  WHITE,
  contrast,
  flatten,
  legible,
  luminance,
  mix,
  onColor,
  parseColor,
  saturation,
  toHex,
  type Rgba,
} from './color'
import {
  COLOR_TOKEN_SET,
  type ColorToken,
  type SyntaxToken,
  type ThemeDefinition,
  type ThemePalette,
} from './tokens'

/** Largest theme text we will look at. A full tweakcn export is ~5 KB. */
export const MAX_THEME_INPUT = 64 * 1024
export const MAX_THEME_NAME = 40
export const MAX_CUSTOM_THEMES = 20

type Vars = Map<string, string>

export class ThemeImportError extends Error {}

const NO_THEME =
  'No theme found. Paste the CSS from tweakcn’s Code button (it starts with ":root {" and has lines like "--background: …"), or a shadcn theme JSON.'

/** Returns the light and/or dark halves found in `text`, fully derived and sanitized. */
export function importTheme(text: string): Pick<ThemeDefinition, 'light' | 'dark' | 'radius'> {
  if (text.length > MAX_THEME_INPUT) {
    throw new ThemeImportError(`That theme is too large (${Math.round(text.length / 1024)} KB). The limit is 64 KB.`)
  }
  const trimmed = text.trim()
  if (!trimmed) throw new ThemeImportError(NO_THEME)

  const blocks = trimmed.startsWith('{') ? jsonBlocks(trimmed) : cssBlocks(trimmed)

  let light = blocks.light ? completePalette(blocks.light) : null
  let dark = blocks.dark ? completePalette(blocks.dark) : null

  // A lone block is whichever mode its background says it is.
  if (light && !dark && light.isDark) [light, dark] = [null, light]
  else if (dark && !light && !dark.isDark) [light, dark] = [dark, null]
  // Never put a dark palette on the light side (or vice versa): the app's
  // `dark:` utilities would then pick the wrong text colors.
  if (light?.isDark) light = null
  if (dark && !dark.isDark) dark = null

  if (!light && !dark) throw new ThemeImportError(NO_THEME)

  const radius = parseRadius(blocks.radius)
  return {
    ...(light ? { light: light.palette } : {}),
    ...(dark ? { dark: dark.palette } : {}),
    ...(radius !== undefined ? { radius } : {}),
  }
}

// ── Reading the input ──────────────────────────────────────────────────────

type Blocks = { light?: Vars; dark?: Vars; radius?: string }

function cssBlocks(css: string): Blocks {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Blocks = {}
  const add = (key: 'light' | 'dark', vars: Vars) => {
    if (!vars.size) return
    const target = (out[key] ??= new Map())
    vars.forEach((v, k) => target.set(k, v))
  }

  if (!source.includes('{')) {
    add('light', declarations(source))
  } else {
    // Innermost blocks only, so `@layer base { :root { … } }` works.
    const re = /([^{}]*)\{([^{}]*)\}/g
    let match: RegExpExecArray | null
    while ((match = re.exec(source))) {
      const selector = match[1].split(/[;}]/).pop()!.trim().toLowerCase()
      const vars = declarations(match[2])
      if (!vars.size) continue
      if (/\.dark\b|\[data-theme=["']?dark|\[data-mode=["']?dark/.test(selector)) add('dark', vars)
      else if (selector === '' || /:root|^html\b|^body\b|\.light\b|\[data-theme=["']?light/.test(selector)) add('light', vars)
    }
  }
  out.radius = out.light?.get('radius') ?? out.dark?.get('radius')
  return out
}

function declarations(body: string): Vars {
  const vars: Vars = new Map()
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const name = declaration.slice(0, colon).trim().toLowerCase()
    if (!name.startsWith('--')) continue
    vars.set(name.slice(2), declaration.slice(colon + 1).trim())
  }
  return vars
}

function jsonBlocks(text: string): Blocks {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ThemeImportError('That looks like JSON but it could not be read. Check that it is complete.')
  }
  const root = isRecord(data) && isRecord(data.cssVars) ? data.cssVars : data
  if (!isRecord(root)) throw new ThemeImportError(NO_THEME)
  const toVars = (value: unknown): Vars | undefined => {
    if (!isRecord(value)) return undefined
    const vars: Vars = new Map()
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string') vars.set(key.replace(/^--/, '').toLowerCase(), v)
    }
    return vars.size ? vars : undefined
  }
  const theme = isRecord(root.theme) ? root.theme : undefined
  const light = toVars(root.light)
  const dark = toVars(root.dark)
  const radius = (typeof theme?.radius === 'string' ? theme.radius : undefined) ?? light?.get('radius') ?? dark?.get('radius')
  return { light, dark, radius }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parseRadius(value: string | undefined): number | undefined {
  if (!value) return undefined
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(rem|px)?\s*$/i.exec(value)
  if (!m) return undefined
  const n = Number(m[1])
  const rem = m[2]?.toLowerCase() === 'px' || (!m[2] && n > 4) ? n / 16 : n
  return Math.round(Math.min(1.5, Math.max(0, rem)) * 1000) / 1000
}

// ── Deriving a full, readable palette ──────────────────────────────────────

/** Defaults the app uses when a theme does not supply a status/chart color. */
const FALLBACK = {
  light: {
    destructive: '#dc2626',
    charts: ['#f97316', '#0d9488', '#1e5a8a', '#eab308', '#f59e0b'],
    syntax: {
      comment: '#8b8e96',
      punctuation: '#5d6068',
      keyword: '#6a4fd0',
      string: '#2a7d4c',
      number: '#b05e14',
      escape: '#0e8073',
      function: '#1f61c4',
      type: '#946500',
      tag: '#c0323a',
    },
  },
  dark: {
    destructive: '#f87171',
    charts: ['#4f6bed', '#2fb38a', '#f59e0b', '#a855f7', '#f43f5e'],
    syntax: {
      comment: '#6b6f77',
      punctuation: '#9a9da5',
      keyword: '#a79df2',
      string: '#8cc8a0',
      number: '#e0a36a',
      escape: '#76cfc4',
      function: '#7db3f5',
      type: '#e2c07c',
      tag: '#e8868b',
    },
  },
} satisfies Record<'light' | 'dark', { destructive: string; charts: string[]; syntax: Record<SyntaxToken, string> }>

const CHART_SYNTAX: [SyntaxToken, string][] = [
  ['keyword', 'chart-1'],
  ['string', 'chart-2'],
  ['number', 'chart-3'],
  ['function', 'chart-4'],
  ['type', 'chart-5'],
]

export type SeedInput = Partial<Record<ColorToken, Rgba>> & { background: Rgba; foreground: Rgba }

/**
 * Fills every token from a partial set of parsed colors, enforcing contrast.
 * Returns null when the block has no usable background/foreground.
 */
export function completePalette(
  vars: Vars,
  overrides?: { syntax?: Partial<Record<SyntaxToken, string>>; accent?: string },
): { palette: ThemePalette; isDark: boolean } | null {
  const parsed = new Map<string, Rgba>()
  vars.forEach((value, name) => {
    if (!COLOR_TOKEN_SET.has(name) && name !== 'sidebar-background') return
    const color = parseColor(value)
    if (color) parsed.set(name === 'sidebar-background' ? (parsed.has('sidebar') ? '' : 'sidebar') : name, color)
  })
  parsed.delete('')
  const rawBg = parsed.get('background')
  const rawFg = parsed.get('foreground')
  if (!rawBg || !rawFg) return null

  const bg = flatten(rawBg, WHITE)
  const isDark = luminance(bg) < 0.4
  const half = isDark ? FALLBACK.dark : FALLBACK.light
  const extreme = isDark ? WHITE : BLACK
  const opaque = (c: Rgba | undefined, over: Rgba) => (c ? flatten(c, over) : undefined)
  const text = (c: Rgba | undefined, on: Rgba, fallback: Rgba, min = 4.5) => legible(opaque(c, on) ?? fallback, on, extreme, min)

  const fg = text(rawFg, bg, rawFg, 7)
  const card = opaque(parsed.get('card'), bg) ?? bg
  const popover = opaque(parsed.get('popover'), bg) ?? card
  const primary = opaque(parsed.get('primary'), bg) ?? fg
  const onPrimary = (c: Rgba | undefined, surface: Rgba) => legible(opaque(c, surface) ?? onColor(surface), surface, onColor(surface), 4.5)
  const subtle = mix(bg, fg, isDark ? 0.09 : 0.05)
  const secondary = opaque(parsed.get('secondary'), bg) ?? subtle
  const muted = opaque(parsed.get('muted'), bg) ?? subtle
  const accentSurface = opaque(parsed.get('accent'), bg) ?? secondary
  const mutedFg = text(parsed.get('muted-foreground'), bg, mix(fg, bg, 0.4), 4.5)
  const rawDestructive = parsed.get('destructive')
  const destructive = legible(
    rawDestructive && saturation(rawDestructive) > 0.25 ? flatten(rawDestructive, bg) : parsePlain(half.destructive),
    bg,
    extreme,
    3,
  )
  const border = parsed.get('border') ?? { ...fg, a: isDark ? 0.12 : 0.13 }
  const input = parsed.get('input') ?? border
  const ring = opaque(parsed.get('ring'), bg) ?? primary
  // The sidebar color is the window frame the main panel sits inset on, so it
  // must be a step darker than the background (as Feather derives its shell).
  // Themes without one, or with a lighter one, get it derived.
  const frame = mix(bg, BLACK, isDark ? 0.3 : 0.035)
  const rawSidebar = opaque(parsed.get('sidebar'), bg)
  const sidebar = rawSidebar && luminance(rawSidebar) < luminance(bg) ? rawSidebar : frame
  const sidebarPrimary = opaque(parsed.get('sidebar-primary'), sidebar) ?? primary
  const sidebarAccent = opaque(parsed.get('sidebar-accent'), sidebar) ?? accentSurface

  const colors: Record<ColorToken, Rgba> = {
    background: bg,
    foreground: fg,
    card,
    'card-foreground': text(parsed.get('card-foreground'), card, fg),
    popover,
    'popover-foreground': text(parsed.get('popover-foreground'), popover, fg),
    primary,
    'primary-foreground': onPrimary(parsed.get('primary-foreground'), primary),
    secondary,
    'secondary-foreground': text(parsed.get('secondary-foreground'), secondary, fg),
    muted,
    'muted-foreground': mutedFg,
    accent: accentSurface,
    'accent-foreground': text(parsed.get('accent-foreground'), accentSurface, fg),
    destructive,
    border,
    input,
    ring,
    'chart-1': chart(parsed.get('chart-1'), half.charts[0], bg),
    'chart-2': chart(parsed.get('chart-2'), half.charts[1], bg),
    'chart-3': chart(parsed.get('chart-3'), half.charts[2], bg),
    'chart-4': chart(parsed.get('chart-4'), half.charts[3], bg),
    'chart-5': chart(parsed.get('chart-5'), half.charts[4], bg),
    sidebar,
    'sidebar-foreground': text(parsed.get('sidebar-foreground'), sidebar, fg),
    'sidebar-primary': sidebarPrimary,
    'sidebar-primary-foreground': onPrimary(parsed.get('sidebar-primary-foreground'), sidebarPrimary),
    'sidebar-accent': sidebarAccent,
    'sidebar-accent-foreground': text(parsed.get('sidebar-accent-foreground'), sidebarAccent, fg),
    'sidebar-border': parsed.get('sidebar-border') ?? border,
    'sidebar-ring': opaque(parsed.get('sidebar-ring'), sidebar) ?? ring,
  }

  // Syntax colors: the theme's chart colors where it has them (as Feather does),
  // kept readable on the background; the rest from the built-in set.
  const syntax: Record<SyntaxToken, string> = { ...half.syntax }
  syntax.comment = toHex(legible(mix(mutedFg, bg, 0.15), bg, extreme, 3))
  syntax.punctuation = toHex(mix(fg, mutedFg, 0.5))
  for (const [cls, token] of CHART_SYNTAX) {
    const c = parsed.get(token)
    if (c) syntax[cls] = toHex(legible(flatten(c, bg), bg, extreme, 3))
  }
  Object.assign(syntax, overrides?.syntax)

  // The brand accent: the first genuinely colorful choice the theme offers.
  const accentCandidates = [primary, sidebarPrimary, ring, colors['chart-1']]
  const brand = accentCandidates.find((c) => saturation(c) > 0.3 && contrast(c, bg) >= 1.6)

  const palette: ThemePalette = {
    colors: Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, toHex(v)])) as Record<ColorToken, string>,
    syntax,
    ...(overrides?.accent ? { accent: overrides.accent } : brand ? { accent: toHex(brand) } : {}),
  }
  return { palette, isDark }
}

function chart(c: Rgba | undefined, fallback: string, bg: Rgba): Rgba {
  return c ? flatten(c, bg) : parsePlain(fallback)
}

function parsePlain(hex: string): Rgba {
  return parseColor(hex) ?? BLACK
}

/** Cleans a user-entered theme name. */
export function cleanThemeName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_THEME_NAME)
  return cleaned || fallback
}
