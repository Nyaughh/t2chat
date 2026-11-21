import { v } from 'convex/values'

/**
 * Stored appearance preferences (see src/lib/theme/appearance.ts).
 *
 * Enum-like fields are plain strings so older/newer clients never fail
 * validation; the client sanitizes unknown values back to defaults. Custom
 * themes are stored as sanitized `#rrggbb[aa]` token maps, never raw CSS, and
 * `updateAppearance` re-checks every key, value and size limit.
 */
const paletteValidator = v.object({
  colors: v.record(v.string(), v.string()),
  syntax: v.optional(v.record(v.string(), v.string())),
  accent: v.optional(v.string()),
})

export const appearanceValidator = v.object({
  version: v.number(),
  updatedAt: v.number(),
  themeId: v.string(),
  customThemes: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      light: v.optional(paletteValidator),
      dark: v.optional(paletteValidator),
      radius: v.optional(v.number()),
    }),
  ),
  accent: v.string(),
  font: v.string(),
  codeFont: v.string(),
  uiScale: v.number(),
  codeSize: v.number(),
  density: v.string(),
  radius: v.string(),
})
