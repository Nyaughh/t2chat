/**
 * Built-in themes. Palettes follow Feather's (src/themes.rs): each is a handful
 * of seed colors, and everything else is derived the same way imports are.
 */

import { completePalette, importTheme } from './import'
import type { SyntaxToken, ThemeDefinition, ThemePalette } from './tokens'

export const DEFAULT_THEME_ID = 'default'

type Seed = {
  /** [shell/sidebar, panel/background, elevated/card, input] */
  surfaces: [string, string, string, string]
  /** [border, strong border] */
  borders: [string, string]
  /** [primary, secondary, muted, faint] */
  texts: [string, string, string, string]
  accent: string
  /** [green, red, yellow, blue, orange, purple, teal] */
  hues: [string, string, string, string, string, string, string]
}

function fromSeed(seed: Seed): ThemePalette {
  const [shell, panel, elevated] = seed.surfaces
  const [border, strong] = seed.borders
  const [text, secondary, muted] = seed.texts
  const [green, red, yellow, blue, orange, purple, teal] = seed.hues
  const vars = new Map<string, string>([
    ['background', panel],
    ['foreground', text],
    ['card', elevated],
    ['popover', elevated],
    ['primary', seed.accent],
    ['secondary', elevated],
    ['muted', elevated],
    ['muted-foreground', secondary],
    ['accent', elevated],
    ['destructive', red],
    ['border', border],
    ['input', strong],
    ['ring', seed.accent],
    ['chart-1', seed.accent],
    ['chart-2', green],
    ['chart-3', yellow],
    ['chart-4', blue],
    ['chart-5', purple],
    ['sidebar', shell],
    ['sidebar-border', border],
  ])
  const syntax: Record<SyntaxToken, string> = {
    comment: muted,
    punctuation: secondary,
    keyword: purple,
    string: green,
    number: orange,
    escape: teal,
    function: blue,
    type: yellow,
    tag: red,
  }
  return completePalette(vars, { syntax, accent: seed.accent })!.palette
}

const seed = (
  surfaces: Seed['surfaces'],
  borders: Seed['borders'],
  texts: Seed['texts'],
  accent: string,
  hues: Seed['hues'],
): Seed => ({ surfaces, borders, texts, accent, hues })

const FEATHER_DARK = seed(
  ['#09090a', '#101112', '#1a1b1d', '#141517'],
  ['#1f2023', '#2c2d31'],
  ['#e9eaec', '#9a9da5', '#62666d', '#45484e'],
  '#5e6ad2',
  ['#4cb782', '#eb5757', '#e2b94a', '#4ea7fc', '#f2994a', '#a79df2', '#76cfc4'],
)
const FEATHER_LIGHT = seed(
  ['#f3f4f6', '#ffffff', '#ffffff', '#ffffff'],
  ['#e4e5e9', '#d3d5db'],
  ['#1b1c20', '#55585f', '#858890', '#b3b6bd'],
  '#5e6ad2',
  ['#23915b', '#d13b3b', '#a9790a', '#2676d0', '#c86f1e', '#6a4fd0', '#0e8073'],
)
const MIDNIGHT = seed(
  ['#000000', '#0a0a0a', '#161616', '#050505'],
  ['#1c1c1c', '#2a2a2a'],
  ['#ededed', '#a1a1a1', '#6b6b6b', '#454545'],
  '#5e6ad2',
  ['#4cb782', '#eb5757', '#e2b94a', '#4ea7fc', '#f2994a', '#a79df2', '#76cfc4'],
)
const CATPPUCCIN_MOCHA = seed(
  ['#11111b', '#1e1e2e', '#313244', '#181825'],
  ['#313244', '#45475a'],
  ['#cdd6f4', '#a6adc8', '#7f849c', '#585b70'],
  '#cba6f7',
  ['#a6e3a1', '#f38ba8', '#f9e2af', '#89b4fa', '#fab387', '#cba6f7', '#94e2d5'],
)
const CATPPUCCIN_LATTE = seed(
  ['#e6e9ef', '#eff1f5', '#eff1f5', '#eff1f5'],
  ['#ccd0da', '#bcc0cc'],
  ['#4c4f69', '#5c5f77', '#7c7f93', '#acb0be'],
  '#8839ef',
  ['#40a02b', '#d20f39', '#df8e1d', '#1e66f5', '#fe640b', '#8839ef', '#179299'],
)
const GRUVBOX_DARK = seed(
  ['#1d2021', '#282828', '#3c3836', '#1d2021'],
  ['#3c3836', '#504945'],
  ['#ebdbb2', '#bdae93', '#928374', '#665c54'],
  '#d79921',
  ['#b8bb26', '#fb4934', '#fabd2f', '#83a598', '#fe8019', '#d3869b', '#8ec07c'],
)
const GRUVBOX_LIGHT = seed(
  ['#f2e5bc', '#fbf1c7', '#f9f5d7', '#f9f5d7'],
  ['#d5c4a1', '#bdae93'],
  ['#3c3836', '#504945', '#7c6f64', '#a89984'],
  '#b57614',
  ['#79740e', '#9d0006', '#b57614', '#076678', '#af3a03', '#8f3f71', '#427b58'],
)
const NORD_DARK = seed(
  ['#272c36', '#2e3440', '#3b4252', '#272c36'],
  ['#3b4252', '#4c566a'],
  ['#eceff4', '#d8dee9', '#7b88a1', '#4c566a'],
  '#88c0d0',
  ['#a3be8c', '#bf616a', '#ebcb8b', '#81a1c1', '#d08770', '#b48ead', '#8fbcbb'],
)
const NORD_LIGHT = seed(
  ['#e5e9f0', '#eceff4', '#f8f9fb', '#f8f9fb'],
  ['#d8dee9', '#c2c9d6'],
  ['#2e3440', '#434c5e', '#6a758c', '#a3acbd'],
  '#5e81ac',
  ['#5f8a4b', '#b0444f', '#a0782b', '#5e81ac', '#b4613f', '#946e8e', '#4f8f8c'],
)
const SOLARIZED_DARK = seed(
  ['#00212b', '#002b36', '#073642', '#00212b'],
  ['#073642', '#0f4a5a'],
  ['#93a1a1', '#839496', '#657b83', '#3f5a63'],
  '#268bd2',
  ['#859900', '#dc322f', '#b58900', '#268bd2', '#cb4b16', '#6c71c4', '#2aa198'],
)
const SOLARIZED_LIGHT = seed(
  ['#eee8d5', '#fdf6e3', '#fffbf0', '#fffbf0'],
  ['#e4ddc8', '#d3cbb4'],
  ['#586e75', '#657b83', '#93a1a1', '#b9c0b6'],
  '#268bd2',
  ['#859900', '#dc322f', '#b58900', '#268bd2', '#cb4b16', '#6c71c4', '#2aa198'],
)
const TOKYO_NIGHT = seed(
  ['#16161e', '#1a1b26', '#24283b', '#16161e'],
  ['#292e42', '#3b4261'],
  ['#c0caf5', '#a9b1d6', '#565f89', '#414868'],
  '#7aa2f7',
  ['#9ece6a', '#f7768e', '#e0af68', '#7aa2f7', '#ff9e64', '#bb9af7', '#7dcfff'],
)
const TOKYO_DAY = seed(
  ['#d5d6db', '#e1e2e7', '#e9e9ed', '#e9e9ed'],
  ['#c4c8da', '#a8aecb'],
  ['#3760bf', '#6172b0', '#848cb5', '#a1a6c5'],
  '#2e7de9',
  ['#587539', '#f52a65', '#8c6c3e', '#2e7de9', '#b15c00', '#9854f1', '#007197'],
)

/** tweakcn's "Claude" theme (as bundled with Feather), with hand-picked code colors. */
const CLAUDE_CSS = `
:root {
  --background: oklch(0.9818 0.0054 95.0986);
  --foreground: oklch(0.3438 0.0269 95.7226);
  --card: oklch(0.9665 0.0067 97.3521);
  --popover: oklch(1.0000 0 0);
  --primary: oklch(0.6171 0.1375 39.0427);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9245 0.0138 92.9892);
  --muted: oklch(0.9341 0.0153 90.2390);
  --muted-foreground: oklch(0.5341 0.0078 97.4503);
  --accent: oklch(0.9245 0.0138 92.9892);
  --destructive: oklch(0.1908 0.0020 106.5859);
  --border: oklch(0.8847 0.0069 97.3627);
  --input: oklch(0.7621 0.0156 98.3528);
  --ring: oklch(0.6171 0.1375 39.0427);
  --sidebar: oklch(0.9663 0.0080 98.8792);
  --sidebar-foreground: oklch(0.3590 0.0051 106.6524);
  --radius: 1rem;
}
.dark {
  --background: oklch(0.2679 0.0036 106.6427);
  --foreground: oklch(0.9576 0.0027 106.4494);
  --card: oklch(0.2928 0.0018 106.5092);
  --popover: oklch(0.3085 0.0035 106.6039);
  --primary: oklch(0.6724 0.1308 38.7559);
  --primary-foreground: oklch(0.1908 0.0020 106.5859);
  --secondary: oklch(0.9818 0.0054 95.0986);
  --muted: oklch(0.2213 0.0038 106.7070);
  --muted-foreground: oklch(0.7713 0.0169 99.0657);
  --accent: oklch(0.2130 0.0078 95.4245);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --border: oklch(0.3618 0.0101 106.8928);
  --input: oklch(0.4336 0.0113 100.2195);
  --ring: oklch(0.6724 0.1308 38.7559);
  --sidebar: oklch(0.2357 0.0024 67.7077);
  --sidebar-foreground: oklch(0.8074 0.0142 93.0137);
  --radius: 1rem;
}`

const CODE_KEYS: SyntaxToken[] = ['keyword', 'string', 'number', 'escape', 'function', 'type', 'tag']
const withCode = (palette: ThemePalette | undefined, code: string[]): ThemePalette | undefined =>
  palette && {
    ...palette,
    syntax: { ...palette.syntax, ...Object.fromEntries(CODE_KEYS.map((k, i) => [k, code[i]])) },
  }

function claude(): ThemeDefinition {
  const theme = importTheme(CLAUDE_CSS)
  return {
    id: 'claude',
    name: 'Claude',
    light: withCode(theme.light, ['#b5522e', '#5b7a2e', '#946500', '#1f7a6c', '#6a4fc9', '#2f6f98', '#b03a2e']),
    dark: withCode(theme.dark, ['#d97757', '#a8b878', '#d9a657', '#7db5a8', '#b0a4e8', '#8ab4cf', '#e0806a']),
    radius: theme.radius,
  }
}

let cached: ThemeDefinition[] | null = null

/** The built-in themes, the app's own first. */
export function presetThemes(): ThemeDefinition[] {
  if (cached) return cached
  const pair = (id: string, name: string, dark: Seed | null, light: Seed | null): ThemeDefinition => ({
    id,
    name,
    ...(dark ? { dark: fromSeed(dark) } : {}),
    ...(light ? { light: fromSeed(light) } : {}),
    radius: 0.375,
  })
  cached = [
    // T2Chat's own look lives in globals.css; it has no overrides.
    { id: DEFAULT_THEME_ID, name: 'T2Chat' },
    pair('feather', 'Feather', FEATHER_DARK, FEATHER_LIGHT),
    claude(),
    pair('midnight', 'Midnight', MIDNIGHT, null),
    pair('catppuccin', 'Catppuccin', CATPPUCCIN_MOCHA, CATPPUCCIN_LATTE),
    pair('gruvbox', 'Gruvbox', GRUVBOX_DARK, GRUVBOX_LIGHT),
    pair('nord', 'Nord', NORD_DARK, NORD_LIGHT),
    pair('solarized', 'Solarized', SOLARIZED_DARK, SOLARIZED_LIGHT),
    pair('tokyo-night', 'Tokyo Night', TOKYO_NIGHT, TOKYO_DAY),
  ]
  return cached
}

/** Swatches used to preview T2Chat's own palette (mirrors globals.css). */
export const DEFAULT_PREVIEW = {
  light: { background: '#faf6f5', foreground: '#1c1514', accent: '#f43f5e', muted: '#7d7371' },
  dark: { background: '#140f0e', foreground: '#fbf8f8', accent: '#fda4af', muted: '#ada4a3' },
}
