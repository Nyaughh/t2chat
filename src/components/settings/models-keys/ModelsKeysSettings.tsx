import React, { useState, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { debounce } from 'lodash'
import { ModelManagementSection } from './ModelManagementSection'
import { LLMProviderKeysSection } from './LLMProviderKeysSection'
import { ModelsKeysSettingsProps, UserSettings, ApiKey, ApiKeyDraft, ModelSettingsState } from './types'

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ConvexError && typeof error.data === 'string' ? error.data : fallback

export function ModelsKeysSettings({ apiKeys, userSettings }: ModelsKeysSettingsProps) {
  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({})
  const [modelSettings, setModelSettings] = useState<ModelSettingsState>({})
  const [optimisticDisabledModels, setOptimisticDisabledModels] = useState<string[]>([])

  const updateSettings = useMutation(api.users.updateUserSettings)
  const saveApiKey = useAction(api.api_keys.saveApiKey)
  const deleteApiKey = useMutation(api.api_keys.deleteApiKey)
  const setDefaultApiKey = useMutation(api.api_keys.setDefaultApiKey)
  const updateDisabledModels = useMutation(api.api_keys.updateDisabledModels)

  const serverDisabledModels = useQuery(api.api_keys.getDisabledModels) || []
  const disabledModels = optimisticDisabledModels.length > 0 ? optimisticDisabledModels : serverDisabledModels

  React.useEffect(() => {
    if (userSettings) setLocalSettings(userSettings)
  }, [userSettings])

  React.useEffect(() => {
    if (serverDisabledModels.length >= 0) setOptimisticDisabledModels(serverDisabledModels)
  }, [serverDisabledModels])

  const debouncedUpdateSettings = useCallback(
    debounce((settings: Partial<UserSettings>) => updateSettings(settings), 500),
    [updateSettings],
  )

  const handleSaveSettings = (settings: Partial<UserSettings>) => {
    const newSettings = { ...localSettings, ...settings }
    setLocalSettings(newSettings)
    debouncedUpdateSettings(settings)
  }

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

  const handleModelEnabledChange = (modelId: string, enabled: boolean) => {
    setModelSettings((prev) => ({ ...prev, [modelId]: { enabled } }))
  }

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    const currentDisabled = optimisticDisabledModels.length > 0 ? optimisticDisabledModels : serverDisabledModels
    const newDisabledModels = enabled 
      ? currentDisabled.filter((id) => id !== modelId)
      : [...currentDisabled, modelId]

    setOptimisticDisabledModels(newDisabledModels)

    try {
      await updateDisabledModels({ disabledModels: newDisabledModels })
    } catch (error) {
      setOptimisticDisabledModels(currentDisabled)
      console.error('Failed to update model settings:', error)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="models" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <ModelManagementSection disabledModels={disabledModels} onToggleModel={handleToggleModel} />
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">API Keys</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your own API keys to use Claude and GPT models and to unlock premium models. Your keys are encrypted at rest and only used for your own chats. When you have a key for a provider, it is used instead of our system keys.
            </p>
          </div>
          <div className="space-y-4 p-3 rounded-lg bg-muted/20 border border-border/50">
            <LLMProviderKeysSection
              title="Anthropic Keys"
              description="Use Claude models with your own Anthropic API key."
              provider="anthropic"
              keyPlaceholder="sk-ant-..."
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
            <LLMProviderKeysSection
              title="OpenAI Keys"
              description="Use GPT models with your own OpenAI API key."
              provider="openai"
              keyPlaceholder="sk-..."
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
            <LLMProviderKeysSection
              title="Gemini Keys"
              description="Manage your API keys for Gemini"
              provider="gemini"
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
            <LLMProviderKeysSection
              title="Groq Keys"
              description="Manage your API keys for Groq"
              provider="groq"
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
            <LLMProviderKeysSection
              title="OpenRouter Keys"
              description="Manage your API keys for OpenRouter"
              provider="openrouter"
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 