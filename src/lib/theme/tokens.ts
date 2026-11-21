/**
 * The design tokens a theme may set. These are exactly the shadcn/ui variables
 * T2Chat's globals.css defines, plus the optional markdown syntax tokens.
 * Anything else in an imported theme is ignored.
 */

export const COLOR_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const

export type ColorToken = (typeof COLOR_TOKENS)[number]

export const SYNTAX_TOKENS = [
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

export type SyntaxToken = (typeof SYNTAX_TOKENS)[number]

/** One half (light or dark) of a theme, all values canonical `#rrggbb[aa]`. */
export type ThemePalette = {
  colors: Partial<Record<ColorToken, string>>
  syntax?: Partial<Record<SyntaxToken, string>>
  /** The brand accent this palette suggests (drives the rose-* scale). */
  accent?: string
}

export type ThemeDefinition = {
  id: string
  name: string
  light?: ThemePalette
  dark?: ThemePalette
  /** Corner radius in rem, if the theme sets one. */
  radius?: number
}

export const COLOR_TOKEN_SET: ReadonlySet<string> = new Set(COLOR_TOKENS)
export const SYNTAX_TOKEN_SET: ReadonlySet<string> = new Set(SYNTAX_TOKENS)
