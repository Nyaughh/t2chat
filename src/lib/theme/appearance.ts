/**
 * The user's appearance preferences and how they become CSS variables.
 *
 * Everything here is pure (no DOM), so it is shared by the settings UI, the
 * provider that applies preferences, and the sanitizer that guards stored data.
 */

import { HEX_COLOR_RE, fromHex, rgbToOklch } from './color'
import { MAX_CUSTOM_THEMES, cleanThemeName } from './import'
import { DEFAULT_THEME_ID, presetThemes } from './presets'
import {
  COLOR_TOKENS,
  COLOR_TOKEN_SET,
  SYNTAX_TOKENS,
  SYNTAX_TOKEN_SET,
  type ThemeDefinition,
  type ThemePalette,
} from './tokens'

// ── Options ────────────────────────────────────────────────────────────────

export const ACCENTS = [
  { id: 'theme', name: 'Theme default', swatch: null },
  { id: 'rose', name: 'Rose', swatch: '#f43f5e' },
  { id: 'orange', name: 'Orange', swatch: '#d9772b' },
  { id: 'amber', name: 'Amber', swatch: '#d99a06' },
  { id: 'green', name: 'Green', swatch: '#2f9e6b' },
  { id: 'teal', name: 'Teal', swatch: '#0f9488' },
  { id: 'blue', name: 'Blue', swatch: '#2f80ed' },
  { id: 'indigo', name: 'Indigo', swatch: '#5e6ad2' },
  { id: 'violet', name: 'Violet', swatch: '#8b5cf6' },
  { id: 'pink', name: 'Pink', swatch: '#d1548e' },
] as const
export type AccentId = (typeof ACCENTS)[number]['id']

/** Main (interface + message) fonts. `stack` only ever references next/font variables or system families. */
export const FONTS = [
  { id: 'inter', name: 'Inter', stack: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' },
  { id: 'system', name: 'System', stack: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  { id: 'geist', name: 'Geist', stack: 'var(--font-geist), ui-sans-serif, system-ui, sans-serif' },
  { id: 'ibm-plex-sans', name: 'IBM Plex Sans', stack: 'var(--font-ibm-plex-sans), ui-sans-serif, system-ui, sans-serif' },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', stack: 'var(--font-atkinson), ui-sans-serif, system-ui, sans-serif' },
  { id: 'serif', name: 'Lora', stack: 'var(--font-lora), Georgia, ui-serif, serif' },
  { id: 'roboto-slab', name: 'Roboto Slab', stack: 'var(--font-roboto-slab), Georgia, ui-serif, serif' },
  { id: 'mono', name: 'JetBrains Mono', stack: 'var(--font-jetbrains-mono), ui-monospace, monospace' },
] as const
export type FontId = (typeof FONTS)[number]['id']

export const CODE_FONTS = [
  { id: 'fira-code', name: 'Fira Code', stack: 'var(--font-fira-code), ui-monospace, monospace' },
  { id: 'jetbrains', name: 'JetBrains Mono', stack: 'var(--font-jetbrains-mono), ui-monospace, monospace' },
  { id: 'source-code-pro', name: 'Source Code Pro', stack: 'var(--font-source-code-pro), ui-monospace, monospace' },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', stack: 'var(--font-ibm-plex-mono), ui-monospace, monospace' },
  { id: 'geist-mono', name: 'Geist Mono', stack: 'var(--font-geist-mono), ui-monospace, monospace' },
  { id: 'consolas', name: 'Consolas', stack: 'Consolas, ui-monospace, Menlo, monospace' },
  { id: 'mono', name: 'System mono', stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
] as const
export type CodeFontId = (typeof CODE_FONTS)[number]['id']

/** Interface size: scales the root font size, and with it everything sized in rem. */
export const UI_SCALES = [0.875, 0.9375, 1, 1.0625, 1.125, 1.25] as const
/** Code font size, in px at 100% interface size. */
export const CODE_SIZES = [12, 13, 14, 15, 16, 18] as const

export const DENSITIES = [
  { id: 'compact', name: 'Compact', spacing: 0.225 },
  { id: 'default', name: 'Default', spacing: 0.25 },
  { id: 'comfortable', name: 'Comfortable', spacing: 0.275 },
] as const
export type DensityId = (typeof DENSITIES)[number]['id']

export const RADII = [
  { id: 'theme', name: 'Theme', rem: null },
  { id: 'none', name: 'Square', rem: 0 },
  { id: 'small', name: 'Small', rem: 0.375 },
  { id: 'medium', name: 'Medium', rem: 0.625 },
  { id: 'large', name: 'Large', rem: 1 },
] as const
export type RadiusId = (typeof RADII)[number]['id']

const DEFAULT_RADIUS_REM = 0.625

// ── The preferences ────────────────────────────────────────────────────────

export type Appearance = {
  version: 1
  /** ms since epoch of the last change; the newer copy wins when syncing. 0 = never changed. */
  updatedAt: number
  themeId: string
  customThemes: ThemeDefinition[]
  accent: AccentId
  font: FontId
  codeFont: CodeFontId
  uiScale: number
  codeSize: number
  density: DensityId
  radius: RadiusId
}

export const DEFAULT_APPEARANCE: Appearance = Object.freeze({
  version: 1,
  updatedAt: 0,
  themeId: DEFAULT_THEME_ID,
  customThemes: [],
  accent: 'theme',
  font: 'inter',
  codeFont: 'fira-code',
  uiScale: 1,
  codeSize: 14,
  density: 'default',
  radius: 'theme',
}) as Appearance

const pick = <T extends string>(value: unknown, allowed: readonly { id: T }[], fallback: T): T =>
  typeof value === 'string' && allowed.some((o) => o.id === value) ? (value as T) : fallback

const pickNumber = (value: unknown, allowed: readonly number[], fallback: number): number =>
  typeof value === 'number' && allowed.includes(value) ? value : fallback

export const CUSTOM_ID_RE = /^custom:[a-z0-9-]{1,40}$/

function sanitizeRecord(value: unknown, allowed: ReadonlySet<string>): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (allowed.has(k) && typeof v === 'string' && HEX_COLOR_RE.test(v)) out[k] = v
  }
  return out
}

function sanitizePalette(value: unknown): ThemePalette | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  const colors = sanitizeRecord(v.colors, COLOR_TOKEN_SET)
  // A palette must at least set its surfaces and text, or it is meaningless.
  if (!colors?.background || !colors.foreground) return undefined
  const syntax = sanitizeRecord(v.syntax, SYNTAX_TOKEN_SET)
  const accent = typeof v.accent === 'string' && HEX_COLOR_RE.test(v.accent) ? v.accent : undefined
  return { colors, ...(syntax && Object.keys(syntax).length ? { syntax } : {}), ...(accent ? { accent } : {}) }
}

function sanitizeTheme(value: unknown): ThemeDefinition | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || !CUSTOM_ID_RE.test(v.id)) return null
  const light = sanitizePalette(v.light)
  const dark = sanitizePalette(v.dark)
  if (!light && !dark) return null
  const radius = typeof v.radius === 'number' && v.radius >= 0 && v.radius <= 1.5 ? v.radius : undefined
  return {
    id: v.id,
    name: cleanThemeName(typeof v.name === 'string' ? v.name : '', 'Imported theme'),
    ...(light ? { light } : {}),
    ...(dark ? { dark } : {}),
    ...(radius !== undefined ? { radius } : {}),
  }
}

/** Turns anything (localStorage, Convex, old versions) into valid preferences. */
export function sanitizeAppearance(value: unknown): Appearance {
  if (typeof value !== 'object' || value === null) return DEFAULT_APPEARANCE
  const v = value as Record<string, unknown>
  const seen = new Set<string>()
  const customThemes = (Array.isArray(v.customThemes) ? v.customThemes : [])
    .slice(0, MAX_CUSTOM_THEMES)
    .map(sanitizeTheme)
    .filter((t): t is ThemeDefinition => !!t && !seen.has(t.id) && !!seen.add(t.id))
  const themeIds = new Set([...presetThemes().map((t) => t.id), ...customThemes.map((t) => t.id)])
  return {
    version: 1,
    updatedAt: typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) ? v.updatedAt : 0,
    themeId: typeof v.themeId === 'string' && themeIds.has(v.themeId) ? v.themeId : DEFAULT_THEME_ID,
    customThemes,
    accent: pick(v.accent, ACCENTS, 'theme'),
    font: pick(v.font, FONTS, 'inter'),
    codeFont: pick(v.codeFont, CODE_FONTS, 'fira-code'),
    uiScale: pickNumber(v.uiScale, UI_SCALES, 1),
    codeSize: pickNumber(v.codeSize, CODE_SIZES, 14),
    density: pick(v.density, DENSITIES, 'default'),
    radius: pick(v.radius, RADII, 'theme'),
  }
}

/** Applies the legacy `mainFont`/`codeFont` columns when the user has no appearance yet. */
export function fromLegacySettings(mainFont: unknown, codeFont: unknown): Partial<Appearance> {
  return {
    ...(typeof mainFont === 'string' && FONTS.some((f) => f.id === mainFont) ? { font: mainFont as FontId } : {}),
    ...(typeof codeFont === 'string' && CODE_FONTS.some((f) => f.id === codeFont) ? { codeFont: codeFont as CodeFontId } : {}),
  }
}

export function findTheme(appearance: Appearance, id = appearance.themeId): ThemeDefinition {
  return (
    presetThemes().find((t) => t.id === id) ??
    appearance.customThemes.find((t) => t.id === id) ??
    presetThemes()[0]
  )
}

// ── CSS variables ──────────────────────────────────────────────────────────

export type AppearanceVars = {
  /** Mode-independent variables, on `:root`. */
  root: Record<string, string>
  /** Light-mode overrides, on `:root:not(.dark)`. */
  light: Record<string, string>
  /** Dark-mode overrides, on `:root.dark`. */
  dark: Record<string, string>
}

/** Tailwind's rose scale (oklch L and C). The app's accent utilities all use rose-*. */
const ROSE_STEPS: [number, number, number][] = [
  [50, 0.969, 0.015],
  [100, 0.941, 0.03],
  [200, 0.892, 0.058],
  [300, 0.81, 0.117],
  [400, 0.712, 0.194],
  [500, 0.645, 0.246],
  [600, 0.586, 0.253],
  [700, 0.514, 0.222],
  [800, 0.455, 0.188],
  [900, 0.41, 0.159],
  [950, 0.271, 0.105],
]

const fmt = (n: number, digits = 3) => String(Math.round(n * 10 ** digits) / 10 ** digits)

/** Re-tints the rose-* scale so every accent utility in the app follows `hex`. */
export function accentScale(hex: string): Record<string, string> {
  const { c, h } = rgbToOklch(fromHex(hex))
  // Keep the theme's own saturation: a muted accent gives a muted scale.
  const strength = Math.min(1.15, c / 0.2)
  const out: Record<string, string> = {}
  for (const [step, l, roseC] of ROSE_STEPS) {
    out[`--color-rose-${step}`] = `oklch(${fmt(l)} ${fmt(roseC * strength)} ${fmt(h, 2)})`
  }
  return out
}

function paletteVars(palette: ThemePalette | undefined): Record<string, string> {
  if (!palette) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(palette.colors)) out[`--${k}`] = v
  for (const [k, v] of Object.entries(palette.syntax ?? {})) out[`--md-syntax-${k}`] = v
  return out
}

export function computeVars(appearance: Appearance): AppearanceVars {
  const theme = findTheme(appearance)
  const root: Record<string, string> = {
    '--app-font-sans': FONTS.find((f) => f.id === appearance.font)!.stack,
    '--app-font-mono': CODE_FONTS.find((f) => f.id === appearance.codeFont)!.stack,
    '--app-ui-scale': String(appearance.uiScale),
    '--app-code-size': `${fmt(appearance.codeSize / 16, 4)}rem`,
  }
  const density = DENSITIES.find((d) => d.id === appearance.density)!
  if (density.id !== 'default') root['--spacing'] = `${density.spacing}rem`
  const radius = RADII.find((r) => r.id === appearance.radius)!.rem ?? theme.radius
  if (radius !== undefined && radius !== DEFAULT_RADIUS_REM) root['--radius'] = `${radius}rem`

  const light = paletteVars(theme.light)
  const dark = paletteVars(theme.dark)

  const chosen = ACCENTS.find((a) => a.id === appearance.accent)!
  if (chosen.id === 'theme') {
    // The app's own rose stays as it is; other themes bring their accent.
    if (theme.light?.accent) Object.assign(light, accentScale(theme.light.accent))
    if (theme.dark?.accent) Object.assign(dark, accentScale(theme.dark.accent))
  } else if (chosen.swatch && chosen.id !== 'rose') {
    Object.assign(root, accentScale(chosen.swatch))
  }
  // Explicit rose keeps Tailwind's own scale, even on a theme with its own accent.
  return { root, light, dark }
}

/**
 * The exact domain of every variable this module can generate. The boot script
 * and `varsToCss` accept nothing else, so a tampered or stale stored snapshot can
 * never inject an unknown property, an unregistered font or an out-of-range size.
 */
export type VarRules = {
  /** Root-only variables with an enumerated set of allowed values. */
  exact: Record<string, string[]>
  /** Per-mode color tokens; values must be `#rrggbb[aa]`. */
  hex: string[]
  /** The accent scale; values must be the `oklch(L C H)` form `accentScale` emits. */
  rose: string[]
}

export const VAR_RULES: VarRules = {
  exact: {
    '--app-font-sans': FONTS.map((f) => f.stack),
    '--app-font-mono': CODE_FONTS.map((f) => f.stack),
    '--app-ui-scale': UI_SCALES.map(String),
    '--app-code-size': CODE_SIZES.map((s) => `${fmt(s / 16, 4)}rem`),
    '--spacing': DENSITIES.filter((d) => d.id !== 'default').map((d) => `${d.spacing}rem`),
  },
  hex: [...COLOR_TOKENS.map((t) => `--${t}`), ...SYNTAX_TOKENS.map((t) => `--md-syntax-${t}`)],
  rose: ROSE_STEPS.map(([step]) => `--color-rose-${step}`),
}

/* eslint-disable no-var -- ES5 on purpose, see below */
/**
 * Builds one CSS rule from untrusted entries, keeping only variables in `rules`.
 * `scope` is 'root' (fonts, sizes, density, radius, accent) or 'mode' (palette
 * colors, syntax colors, accent). Deliberately self-contained ES5 with no outside
 * references: its source is embedded verbatim in the pre-paint boot script.
 */
export function cssBlock(rules: VarRules, scope: string, selector: string, entries: unknown): string {
  if (!entries || typeof entries !== 'object') return ''
  var has = Object.prototype.hasOwnProperty
  var obj = entries as Record<string, unknown>
  var body = ''
  for (var k in obj) {
    if (!has.call(obj, k)) continue
    var v = obj[k]
    if (typeof v !== 'string') continue
    var ok = false
    if (rules.rose.indexOf(k) !== -1) {
      ok = /^oklch\((?:0|1|0\.\d{1,3}) (?:0|0\.\d{1,3}) \d{1,3}(?:\.\d{1,2})?\)$/.test(v)
    } else if (scope === 'mode') {
      ok = rules.hex.indexOf(k) !== -1 && /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)
    } else if (k === '--radius') {
      ok = /^\d(?:\.\d{1,3})?rem$/.test(v) && parseFloat(v) <= 1.5
    } else {
      ok = has.call(rules.exact, k) && rules.exact[k].indexOf(v) !== -1
    }
    if (ok) body += k + ':' + v + ';'
  }
  return body ? selector + '{' + body + '}' : ''
}
/* eslint-enable no-var */

export function varsToCss(vars: AppearanceVars): string {
  // Doubled/compound selectors outrank globals.css's `:root` and `.dark` regardless of order.
  return (
    cssBlock(VAR_RULES, 'root', ':root:root', vars.root) +
    cssBlock(VAR_RULES, 'mode', ':root:not(.dark)', vars.light) +
    cssBlock(VAR_RULES, 'mode', ':root.dark', vars.dark)
  )
}

export const APPEARANCE_STORAGE_KEY = 't2chat-appearance'
/** Precomputed variables for the pre-paint boot script. */
export const APPEARANCE_VARS_STORAGE_KEY = 't2chat-appearance-vars'
export const APPEARANCE_STYLE_ID = 't2chat-appearance'

/** Font stacks for the pre-engine `mainFont` / `codeFont` cookies (their ids are a subset of ours). */
export const LEGACY_COOKIE_FONTS = {
  mainFont: Object.fromEntries(FONTS.map((f) => [f.id, f.stack])),
  codeFont: Object.fromEntries(CODE_FONTS.map((f) => [f.id, f.stack])),
}

/** Reads the legacy font cookies, keeping only known ids. */
export function legacyCookieFonts(cookie: string): Partial<Pick<Appearance, 'font' | 'codeFont'>> {
  const read = (name: string) => {
    const m = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(cookie)
    try {
      return m ? decodeURIComponent(m[1]) : null
    } catch {
      return null
    }
  }
  return fromLegacySettings(read('mainFont'), read('codeFont'))
}

/**
 * Runs in <head> before first paint, so a saved theme never flashes the default.
 * Self-contained (it is serialized into the page): it rebuilds the CSS from the
 * stored variables with `cssBlock` and the exact `VAR_RULES` domains. With no
 * stored snapshot yet, it applies the legacy font cookies (allowlisted ids only).
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var R=${JSON.stringify(VAR_RULES)};var B=(${cssBlock.toString()});var css='';var raw=localStorage.getItem(${JSON.stringify(
  APPEARANCE_VARS_STORAGE_KEY,
)});if(raw&&raw.length<65536){var v=JSON.parse(raw);css=B(R,'root',':root:root',v&&v.root)+B(R,'mode',':root:not(.dark)',v&&v.light)+B(R,'mode',':root.dark',v&&v.dark)}else{var L=${JSON.stringify(
  LEGACY_COOKIE_FONTS,
)};var c=document.cookie,e={};var g=function(n){var m=new RegExp('(?:^|; )'+n+'=([^;]*)').exec(c);try{return m?decodeURIComponent(m[1]):null}catch(x){return null}};var a=g('mainFont'),b=g('codeFont');if(a&&Object.prototype.hasOwnProperty.call(L.mainFont,a))e['--app-font-sans']=L.mainFont[a];if(b&&Object.prototype.hasOwnProperty.call(L.codeFont,b))e['--app-font-mono']=L.codeFont[b];css=B(R,'root',':root:root',e)}if(!css)return;var el=document.createElement('style');el.id=${JSON.stringify(
  APPEARANCE_STYLE_ID,
)};el.textContent=css;document.head.appendChild(el)}catch(e){}})()`
