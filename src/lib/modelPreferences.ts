import { DEFAULT_MODEL_ID, models, type ModelInfo } from './models'

/** The user's model picker settings (Settings → Models). Guests always get the defaults. */
export interface ModelPreferences {
  disabledModels: readonly string[]
  disabledProviders: readonly string[]
  /** Hide models the user can't use right now (missing API key, sign-in required). */
  showOnlyAvailable: boolean
}

/** What the user can currently run: signed in or not, and which providers they added a key for. */
export interface ModelAccess {
  isSignedIn: boolean
  keyProviders: readonly string[]
  /** Free models whose server key is missing, used up or rate limited right now. */
  serverUnavailable?: readonly string[]
}

export const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
  disabledModels: [],
  disabledProviders: [],
  showOnlyAvailable: false,
}

/**
 * A free model the user would run on the server key (no own key for its provider) while that key is
 * missing, used up or rate limited. Such models are never shown: picking them would only error.
 */
const isServerBlocked = (model: ModelInfo, access: ModelAccess) =>
  !!model.isFree && !access.keyProviders.includes(model.provider) && !!access.serverUnavailable?.includes(model.id)

/** Whether the user can send with this model right now (ignores their show/hide settings). */
export const isModelUsable = (model: ModelInfo, access: ModelAccess): boolean => {
  if (!access.isSignedIn && !model.isFree) return false
  if (model.isApiKeyOnly) return access.keyProviders.includes(model.provider)
  return !isServerBlocked(model, access)
}

/** Whether the user's settings, or the model being unavailable on the server key, hide it. */
export const isModelHidden = (model: ModelInfo, prefs: ModelPreferences, access: ModelAccess): boolean => {
  if (isServerBlocked(model, access)) return true
  if (prefs.disabledModels.includes(model.id)) return true
  if (prefs.disabledProviders.includes(model.provider)) return true
  if (prefs.showOnlyAvailable && !isModelUsable(model, access)) return true
  return false
}

/**
 * Models the picker lists, in catalog order. Never empty, and always has a usable model: if the
 * user's settings hide every usable one, the default model (or the first usable one) is kept.
 */
export const getPickerModels = (
  prefs: ModelPreferences,
  access: ModelAccess,
  list: readonly ModelInfo[] = models,
): ModelInfo[] => {
  const visible = list.filter((model) => !isModelHidden(model, prefs, access))
  if (visible.some((model) => isModelUsable(model, access))) return visible
  const defaultModel = list.find((model) => model.id === DEFAULT_MODEL_ID)
  const fallback =
    [defaultModel, ...list].find((model) => model && isModelUsable(model, access)) ?? defaultModel ?? list[0]
  return list.filter((model) => model === fallback || visible.includes(model))
}

/** Models the user can actually pick and send with. */
export const getSelectableModels = (
  prefs: ModelPreferences,
  access: ModelAccess,
  list: readonly ModelInfo[] = models,
): ModelInfo[] => getPickerModels(prefs, access, list).filter((model) => isModelUsable(model, access))

/**
 * The model to show in the composer. Uses the saved model when it still exists and is selectable,
 * otherwise falls back to the default model (or the first selectable one). Pure: never persists the
 * fallback, so a saved choice survives while keys/settings are loading or a key is briefly removed.
 */
export const resolveSelectedModel = (
  savedModelId: string | null | undefined,
  prefs: ModelPreferences,
  access: ModelAccess,
  list: readonly ModelInfo[] = models,
): ModelInfo => {
  const selectable = getSelectableModels(prefs, access, list)
  const saved = savedModelId ? selectable.find((model) => model.id === savedModelId) : undefined
  return saved ?? selectable.find((model) => model.id === DEFAULT_MODEL_ID) ?? selectable[0] ?? list[0]
}
