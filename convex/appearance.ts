import { query, mutation } from './_generated/server'
import { ConvexError, type Infer } from 'convex/values'
import { betterAuthComponent } from './auth'
import { Id } from './_generated/dataModel'
import { appearanceValidator } from './appearanceValidator'

type Appearance = Infer<typeof appearanceValidator>

const MAX_CUSTOM_THEMES = 20
const MAX_NAME = 40
const MAX_COLOR_KEYS = 40
const MAX_SYNTAX_KEYS = 12
const KEY_RE = /^[a-z0-9-]{1,32}$/
const HEX_RE = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/
const SHORT_ID_RE = /^[a-z0-9:-]{1,48}$/
const CUSTOM_ID_RE = /^custom:[a-z0-9-]{1,40}$/

function checkTokenMap(map: Record<string, string> | undefined, maxKeys: number, label: string) {
  if (!map) return
  const entries = Object.entries(map)
  if (entries.length > maxKeys) throw new ConvexError(`Too many ${label} tokens`)
  for (const [key, value] of entries) {
    if (!KEY_RE.test(key) || !HEX_RE.test(value)) throw new ConvexError(`Invalid ${label} token`)
  }
}

function checkAppearance(a: Appearance) {
  if (a.version !== 1) throw new ConvexError('Unsupported appearance version')
  if (!Number.isFinite(a.updatedAt) || a.updatedAt < 0) throw new ConvexError('Invalid timestamp')
  for (const value of [a.themeId, a.accent, a.font, a.codeFont, a.density, a.radius]) {
    if (!SHORT_ID_RE.test(value)) throw new ConvexError('Invalid appearance option')
  }
  if (!Number.isFinite(a.uiScale) || a.uiScale < 0.5 || a.uiScale > 2) throw new ConvexError('Invalid interface size')
  if (!Number.isFinite(a.codeSize) || a.codeSize < 8 || a.codeSize > 32) throw new ConvexError('Invalid code size')
  if (a.customThemes.length > MAX_CUSTOM_THEMES) throw new ConvexError('Too many custom themes')
  for (const theme of a.customThemes) {
    if (!CUSTOM_ID_RE.test(theme.id)) throw new ConvexError('Invalid theme id')
    if (theme.name.length > MAX_NAME) throw new ConvexError('Theme name too long')
    if (theme.radius !== undefined && !(theme.radius >= 0 && theme.radius <= 1.5)) {
      throw new ConvexError('Invalid theme radius')
    }
    if (!theme.light && !theme.dark) throw new ConvexError('Theme has no palette')
    for (const palette of [theme.light, theme.dark]) {
      if (!palette) continue
      checkTokenMap(palette.colors, MAX_COLOR_KEYS, 'color')
      checkTokenMap(palette.syntax, MAX_SYNTAX_KEYS, 'syntax')
      if (palette.accent !== undefined && !HEX_RE.test(palette.accent)) throw new ConvexError('Invalid accent')
    }
  }
}

/** The signed-in user's appearance preferences, or null (guest / never saved). */
export const getAppearance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) return null
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .unique()
    if (!settings) return null
    return {
      appearance: settings.appearance ?? null,
      // Pre-appearance font choices, so they carry over the first time.
      legacy: { mainFont: settings.mainFont ?? null, codeFont: settings.codeFont ?? null },
    }
  },
})

/** Saves the caller's own appearance. Stale writes (older `updatedAt`) are ignored. */
export const updateAppearance = mutation({
  args: { appearance: appearanceValidator },
  handler: async (ctx, { appearance }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Not authenticated')
    checkAppearance(appearance)

    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .unique()

    if (!settings) {
      await ctx.db.insert('userSettings', { userId: userId as Id<'users'>, appearance })
      return
    }
    if (settings.appearance && settings.appearance.updatedAt > appearance.updatedAt) return
    await ctx.db.patch(settings._id, { appearance })
  },
})
