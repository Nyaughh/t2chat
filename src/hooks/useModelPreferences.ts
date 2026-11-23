import { useMemo } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useServerModelAvailability } from './useServerModelAvailability'
import { DEFAULT_MODEL_PREFERENCES, type ModelAccess, type ModelPreferences } from '@/lib/modelPreferences'

/**
 * The signed-in user's model picker settings, API key providers and which free (server-key) models
 * are available right now. Guests get the default settings. `isLoading` stays true until settings
 * and keys have answered, so callers don't treat key-only models as unavailable while keys load.
 */
export function useModelPreferences() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const userSettings = useQuery(api.users.getMySettings, isAuthenticated ? {} : 'skip')
  const apiKeys = useQuery(api.api_keys.getApiKeys, isAuthenticated ? {} : 'skip')
  const serverAvailability = useServerModelAvailability()

  const isLoading = isAuthLoading || (isAuthenticated && (userSettings === undefined || apiKeys === undefined))

  const prefs = useMemo<ModelPreferences>(() => {
    if (!isAuthenticated || !userSettings) return DEFAULT_MODEL_PREFERENCES
    return {
      disabledModels: userSettings.disabledModels ?? [],
      disabledProviders: userSettings.disabledProviders ?? [],
      showOnlyAvailable: userSettings.showOnlyAvailableModels ?? false,
    }
  }, [isAuthenticated, userSettings])

  const access = useMemo<ModelAccess>(
    () => ({
      isSignedIn: isAuthenticated,
      keyProviders: isAuthenticated ? (apiKeys ?? []).map((key) => key.service) : [],
      // Until availability loads nothing counts as unavailable (the server enforces it regardless)
      serverUnavailable: Object.entries(serverAvailability ?? {})
        .filter(([, status]) => !status.available)
        .map(([modelId]) => modelId),
    }),
    [isAuthenticated, apiKeys, serverAvailability],
  )

  return {
    prefs,
    access,
    isLoading,
    savedModelId: isAuthenticated ? userSettings?.selectedModelId : undefined,
  }
}
