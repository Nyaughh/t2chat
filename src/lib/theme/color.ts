/**
 * Color parsing and math for the theme engine.
 *
 * Imported themes are untrusted text, so every color goes through `parseColor`
 * and comes back out as a plain `#rrggbb` / `#rrggbbaa` string. Nothing a user
 * pastes is ever written to CSS verbatim.
 */

export type Rgba = { r: number; g: number; b: number; a: number }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const byte = (v: number) => clamp(Math.round(v), 0, 255)

/** Parses the notations shadcn/tweakcn themes use: oklch(), hsl(), bare `H S% L%`, rgb(), #hex. */
export function parseColor(input: string): Rgba | null {
  const value = input.trim().replace(/\s*!important\s*$/i, '').trim()
  if (!value || value.length > 64) return null
  if (value.startsWith('#')) return parseHex(value.slice(1))

  const lower = value.toLowerCase()
  const open = lower.indexOf('(')
  let fn = ''
  let args = lower
  if (open !== -1) {
    if (!lower.endsWith(')')) return null
    fn = lower.slice(0, open).trim()
    args = lower.slice(open + 1, -1)
  }
  if (!/^[0-9a-z.%,/ +-]*$/.test(args)) return null

  const [main, alphaPart] = args.split('/')
  const parts = main.split(/[\s,]+/).filter(Boolean)
  // Legacy comma syntax may carry alpha as a 4th component: rgba(1, 2, 3, 0.5)
  let alphaText = alphaPart?.trim()
  if (!alphaText && parts.length === 4) alphaText = parts[3]
  if (parts.length < 3) return null

  const num = (text: string, percentOf: number): number | null => {
    if (text.endsWith('%')) {
      const n = Number(text.slice(0, -1))
      return Number.isFinite(n) ? (n / 100) * percentOf : null
    }
    const n = Number(text.replace(/deg$/, ''))
    return Number.isFinite(n) ? n : null
  }
  const alpha = alphaText ? num(alphaText, 1) : 1
  if (alpha === null) return null
  const a = clamp(alpha, 0, 1)

  switch (fn) {
    case 'oklch': {
      const l = num(parts[0], 1)
      const c = num(parts[1], 0.4)
      const h = num(parts[2], 360)
      if (l === null || c === null || h === null) return null
      return { ...oklchToRgb(l > 1 ? l / 100 : l, c, h), a }
    }
    case 'rgb':
    case 'rgba': {
      const r = num(parts[0], 255)
      const g = num(parts[1], 255)
      const b = num(parts[2], 255)
      if (r === null || g === null || b === null) return null
      return { r: byte(r), g: byte(g), b: byte(b), a }
    }
    case 'hsl':
    case 'hsla':
    case '': {
      const h = num(parts[0], 360)
      const s = num(parts[1], 1)
      const l = num(parts[2], 1)
      if (h === null || s === null || l === null) return null
      // Bare numbers without % (e.g. "240 5 10") are percentages in old shadcn themes.
      const sat = parts[1].endsWith('%') ? s : s / 100
      const light = parts[2].endsWith('%') ? l : l / 100
      return { ...hslToRgb(h, clamp(sat, 0, 1), clamp(light, 0, 1)), a }
    }
    default:
      return null
  }
}

function parseHex(hex: string): Rgba | null {
  if (!/^[0-9a-f]+$/i.test(hex)) return null
  const d = (i: number) => parseInt(hex[i], 16) * 17
  const p = (i: number) => parseInt(hex.slice(i, i + 2), 16)
  switch (hex.length) {
    case 3:
      return { r: d(0), g: d(1), b: d(2), a: 1 }
    case 4:
      return { r: d(0), g: d(1), b: d(2), a: d(3) / 255 }
    case 6:
      return { r: p(0), g: p(2), b: p(4), a: 1 }
    case 8:
      return { r: p(0), g: p(2), b: p(4), a: p(6) / 255 }
    default:
      return null
  }
}

const toLinear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const fromLinear = (v: number) => {
  const c = clamp(v, 0, 1)
  return byte((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255)
}

export function oklchToRgb(l: number, c: number, hDeg: number): Omit<Rgba, 'a'> {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: fromLinear(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: fromLinear(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: fromLinear(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  }
}

export function rgbToOklch({ r, g, b }: Omit<Rgba, 'a'>): { l: number; c: number; h: number } {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.sqrt(A * A + B * B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { l: L, c: C, h: H }
}

function hslToRgb(hue: number, s: number, l: number): Omit<Rgba, 'a'> {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const h = (((hue % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((h % 2) - 1))
  const [r, g, b] =
    h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x]
  const m = l - chroma / 2
  return { r: byte((r + m) * 255), g: byte((g + m) * 255), b: byte((b + m) * 255) }
}

const hex2 = (v: number) => byte(v).toString(16).padStart(2, '0')

/** Canonical, injection-safe serialization. */
export function toHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`
  return c.a >= 0.999 ? base : `${base}${hex2(c.a * 255)}`
}

export const HEX_COLOR_RE = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/

export function fromHex(hex: string): Rgba {
  return parseHex(hex.slice(1)) ?? { r: 0, g: 0, b: 0, a: 1 }
}

/** Relative luminance, 0 (black) to 1 (white). Alpha is ignored. */
export function luminance(c: Rgba): number {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b)
}

export function contrast(a: Rgba, b: Rgba): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Blends `t` of the way from `a` to `b` (opaque result). */
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const lerp = (x: number, y: number) => x + (y - x) * t
  return { r: byte(lerp(a.r, b.r)), g: byte(lerp(a.g, b.g)), b: byte(lerp(a.b, b.b)), a: 1 }
}

/** Composites a (possibly translucent) color over an opaque background. */
export function flatten(c: Rgba, over: Rgba): Rgba {
  return { ...mix(over, { ...c, a: 1 }, c.a), a: 1 }
}

/** How far a color is from gray, 0 to 1. */
export function saturation(c: Rgba): number {
  const max = Math.max(c.r, c.g, c.b)
  const min = Math.min(c.r, c.g, c.b)
  return max === 0 ? 0 : (max - min) / max
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 }

/** Nudges `color` toward `toward` until it reaches `min` contrast against `background`. */
export function legible(color: Rgba, background: Rgba, toward: Rgba, min: number): Rgba {
  const bg = { ...background, a: 1 }
  let out = { ...color, a: 1 }
  for (let step = 1; step <= 20 && contrast(out, bg) < min; step++) {
    out = mix(color, toward, step / 20)
  }
  if (contrast(out, bg) < min) {
    // The hint direction was wrong (e.g. a mid-gray background): pick whichever extreme reads.
    out = contrast(WHITE, bg) >= contrast(BLACK, bg) ? WHITE : BLACK
  }
  return out
}

/** Black or white, whichever reads better on `background`. */
export function onColor(background: Rgba): Rgba {
  return contrast(WHITE, background) >= contrast(BLACK, background) ? WHITE : BLACK
}
