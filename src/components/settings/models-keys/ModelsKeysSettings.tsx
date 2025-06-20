import React, { useState, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { debounce } from 'lodash'
import { ModelManagementSection } from './ModelManagementSection'
import { LLMProviderKeysSection } from './LLMProviderKeysSection'
import { ModelsKeysSettingsProps, UserSettings, ApiKey, ModelSettingsState } from './types'

export function ModelsKeysSettings({ apiKeys, userSettings }: ModelsKeysSettingsProps) {
  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({})
  const [modelSettings, setModelSettings] = useState<ModelSettingsState>({})
  const [optimisticDisabledModels, setOptimisticDisabledModels] = useState<string[]>([])

  const updateSettings = useMutation(api.users.updateUserSettings)
  const saveApiKey = useMutation(api.api_keys.saveApiKey)
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

  const handleSaveApiKey = async (keyData: Partial<ApiKey>) => {
    const { _id, name, service, key } = keyData
    if (name && service && key) await saveApiKey({ _id, name, service, key })
  }

  const handleDeleteApiKey = async (id: string) => await deleteApiKey({ _id: id as any })

  const handleSetDefault = async (id: string) => await setDefaultApiKey({ _id: id as any })

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
              Add your own API keys to access premium models. When available, your keys will be used automatically instead of our system keys.
            </p>
          </div>
          <div className="space-y-4 p-3 rounded-lg bg-muted/20 border border-border/50">
            <LLMProviderKeysSection
              title="Gemini Keys"
              provider="gemini"
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
            <LLMProviderKeysSection
              title="Groq Keys"
              provider="groq"
              keys={apiKeys}
              onSave={handleSaveApiKey}
              onDelete={handleDeleteApiKey}
              onSetDefault={handleSetDefault}
            />
            <LLMProviderKeysSection
              title="OpenRouter Keys"
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