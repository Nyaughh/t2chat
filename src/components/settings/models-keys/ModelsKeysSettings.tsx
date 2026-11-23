import React, { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { ModelManagementSection } from './ModelManagementSection'
import { LLMProviderKeysSection } from './LLMProviderKeysSection'
import { ModelsKeysSettingsProps, ApiKey, ApiKeyDraft, LLMProviderKeysSectionProps } from './types'

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ConvexError && typeof error.data === 'string' ? error.data : fallback

const NO_MODELS: string[] = []

/** An optimistic value that only applies while the server value is the one it was set against. */
function usePending<T>(serverValue: T) {
  const [pending, setPending] = useState<{ value: T; base: T } | null>(null)
  const current = pending && Object.is(pending.base, serverValue) ? pending.value : null
  const set = (value: T | null) => setPending(value === null ? null : { value, base: serverValue })
  return [current, set] as const
}

export function ModelsKeysSettings({ apiKeys, userSettings, view = 'models' }: ModelsKeysSettingsProps) {
  const saveApiKey = useAction(api.api_keys.saveApiKey)
  const deleteApiKey = useMutation(api.api_keys.deleteApiKey)
  const setDefaultApiKey = useMutation(api.api_keys.setDefaultApiKey)
  const updateDisabledModels = useMutation(api.api_keys.updateDisabledModels)
  const updateModelVisibility = useMutation(api.api_keys.updateModelVisibility)

  // Convex returns a stable array until the data changes. The old `|| []` fallback made a new
  // array every render, and an effect keyed on it re-set state forever while the query loaded.
  const serverDisabledModels = useQuery(api.api_keys.getDisabledModels) ?? NO_MODELS
  const serverDisabledProviders = userSettings?.disabledProviders ?? NO_MODELS
  const serverShowOnlyAvailable = userSettings?.showOnlyAvailableModels ?? false

  // A pending toggle shows immediately and is dropped once the server value changes.
  const [pendingDisabledModels, setPendingDisabledModels] = usePending(serverDisabledModels)
  const [pendingDisabledProviders, setPendingDisabledProviders] = usePending(serverDisabledProviders)
  const [pendingShowOnlyAvailable, setPendingShowOnlyAvailable] = usePending(serverShowOnlyAvailable)
  const disabledModels = pendingDisabledModels ?? serverDisabledModels
  const disabledProviders = pendingDisabledProviders ?? serverDisabledProviders
  const showOnlyAvailable = pendingShowOnlyAvailable ?? serverShowOnlyAvailable

  const handleSaveApiKey = async ({ _id, name, service, key }: ApiKeyDraft) => {
    try {
      await saveApiKey({ _id, name, service, key: key.trim() || undefined })
      toast.success(_id ? 'API key updated.' : 'API key saved.')
      return true
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the API key. Please try again.'))
      return false
    }
  }

  const handleDeleteApiKey = async (id: ApiKey['_id']) => {
    try {
      await deleteApiKey({ _id: id })
      toast.success('API key removed.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove the API key. Please try again.'))
    }
  }

  const handleSetDefault = async (id: ApiKey['_id']) => {
    try {
      await setDefaultApiKey({ _id: id })
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the default key. Please try again.'))
    }
  }

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    const currentDisabled = disabledModels
    const newDisabledModels = enabled
      ? currentDisabled.filter((id) => id !== modelId)
      : [...currentDisabled.filter((id) => id !== modelId), modelId]

    setPendingDisabledModels(newDisabledModels)

    try {
      await updateDisabledModels({ disabledModels: newDisabledModels })
    } catch (error) {
      setPendingDisabledModels(null)
      toast.error('Could not update your models. Please try again.')
      console.error('Failed to update model settings:', error)
    }
  }

  const handleToggleProvider = async (provider: string, enabled: boolean) => {
    const next = enabled
      ? disabledProviders.filter((id) => id !== provider)
      : [...disabledProviders.filter((id) => id !== provider), provider]
    setPendingDisabledProviders(next)
    try {
      await updateModelVisibility({ disabledProviders: next })
    } catch (error) {
      setPendingDisabledProviders(null)
      toast.error('Could not update your providers. Please try again.')
      console.error('Failed to update provider settings:', error)
    }
  }

  const handleToggleShowOnlyAvailable = async (enabled: boolean) => {
    setPendingShowOnlyAvailable(enabled)
    try {
      await updateModelVisibility({ showOnlyAvailableModels: enabled })
    } catch (error) {
      setPendingShowOnlyAvailable(null)
      toast.error('Could not update your models. Please try again.')
      console.error('Failed to update model settings:', error)
    }
  }

  if (view === 'models') {
    return (
      <ModelManagementSection
        disabledModels={disabledModels}
        disabledProviders={disabledProviders}
        showOnlyAvailable={showOnlyAvailable}
        keyProviders={apiKeys.map((key) => key.service)}
        onToggleModel={handleToggleModel}
        onToggleProvider={handleToggleProvider}
        onToggleShowOnlyAvailable={handleToggleShowOnlyAvailable}
      />
    )
  }

  const providers: Array<Omit<LLMProviderKeysSectionProps, 'keys' | 'onSave' | 'onDelete' | 'onSetDefault'>> = [
    {
      title: 'Anthropic',
      description: 'Use Claude models with your own key.',
      provider: 'anthropic',
      keyPlaceholder: 'sk-ant-...',
    },
    { title: 'OpenAI', description: 'Use GPT models with your own key.', provider: 'openai', keyPlaceholder: 'sk-...' },
    { title: 'Gemini', description: 'Use Gemini models with your own key.', provider: 'gemini' },
    { title: 'Groq', description: 'Use Groq-hosted models with your own key.', provider: 'groq' },
    { title: 'OpenRouter', description: 'Use OpenRouter models with your own key.', provider: 'openrouter' },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Add your own API keys to use Claude and GPT models and to unlock premium models. Keys are encrypted at rest and
        only used for your own chats. When you have a key for a provider, it is used instead of our system keys.
      </p>
      {providers.map((provider) => (
        <LLMProviderKeysSection
          key={provider.provider}
          {...provider}
          keys={apiKeys}
          onSave={handleSaveApiKey}
          onDelete={handleDeleteApiKey}
          onSetDefault={handleSetDefault}
        />
      ))}
    </div>
  )
}
