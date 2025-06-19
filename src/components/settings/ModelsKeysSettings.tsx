import React, { useState, useCallback } from 'react'
import { Doc } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Key, Plus, Trash2, Edit3, Eye, EyeOff, CheckCircle, Circle, Brain, Settings, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { debounce } from 'lodash'
import { getVendorColor, models, type ModelInfo } from '@/lib/models'

export type ApiKey = Doc<'apiKeys'>
export type UserSettings = Doc<'userSettings'>

export type ModelSettingsState = {
  [modelId: string]: { enabled: boolean }
}

interface ModelsKeysSettingsProps {
  apiKeys: ApiKey[]
  userSettings: UserSettings | null | undefined
}

const SectionWrapper = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) => (
  <div>
    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
    <div className="space-y-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50 p-4">{children}</div>
  </div>
)

const InlineKeyForm = ({
  editingKey,
  onValueChange,
  onSave,
  onCancel,
}: {
  editingKey: Partial<ApiKey>
  onValueChange: (data: Partial<ApiKey>) => void
  onSave: () => void
  onCancel: () => void
}) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="p-4 rounded-xl bg-muted/30 backdrop-blur-sm border border-border/60 mt-2 space-y-3"
  >
    <h4 className="font-semibold text-sm text-foreground">{editingKey._id ? 'Edit' : 'Add New'} Key</h4>
    <input
      type="text"
      placeholder="Key Name (e.g., Personal Key)"
      value={editingKey.name || ''}
      onChange={(e) => onValueChange({ ...editingKey, name: e.target.value })}
      className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 outline-none transition-all duration-200 backdrop-blur-sm"
    />
    <input
      type="password"
      placeholder="API Key"
      value={editingKey.key || ''}
      onChange={(e) => onValueChange({ ...editingKey, key: e.target.value })}
      className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 outline-none transition-all duration-200 backdrop-blur-sm"
    />
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onSave}>
        Save Key
      </Button>
    </div>
  </motion.div>
)

const ModelManagementSection = ({
  disabledModels,
  onToggleModel,
}: {
  disabledModels: string[]
  onToggleModel: (modelId: string, enabled: boolean) => void
}) => {
  const [groupBy, setGroupBy] = useState<'provider' | 'category'>('category')
  const [searchFilter, setSearchFilter] = useState('')

  // Filter models based on search
  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.category.toLowerCase().includes(searchFilter.toLowerCase()),
  )

  // Group models
  const groupedModels = filteredModels.reduce(
    (acc, model) => {
      const groupKey = groupBy === 'provider' ? model.provider : model.category
      if (!acc[groupKey]) {
        acc[groupKey] = []
      }
      acc[groupKey].push(model)
      return acc
    },
    {} as Record<string, ModelInfo[]>,
  )

  // Sort groups and models within groups
  const sortedGroupedModels = Object.entries(groupedModels)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce(
      (acc, [groupKey, groupModels]) => {
        const sortedModels = groupModels.sort((a, b) => {
          if (groupBy === 'provider') {
            if (a.category !== b.category) {
              return a.category.localeCompare(b.category)
            }
          }
          return a.name.localeCompare(b.name)
        })
        acc[groupKey] = sortedModels
        return acc
      },
      {} as Record<string, ModelInfo[]>,
    )

  return (
    <SectionWrapper
      title="Model Management"
      description="Enable or disable specific AI models. Disabled models won't appear in model selection dropdowns."
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <input
            type="text"
            placeholder="Search models..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 outline-none transition-all duration-200 backdrop-blur-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Group by:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupBy(groupBy === 'provider' ? 'category' : 'provider')}
              className="capitalize"
            >
              {groupBy}
            </Button>
          </div>
        </div>

        {/* Model Groups */}
        <div className="space-y-4">
          {Object.entries(sortedGroupedModels).map(([groupKey, groupModels]) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    getVendorColor(groupBy === 'provider' ? groupModels[0]?.category || groupKey : groupKey),
                  )}
                />
                <h4 className="font-medium text-sm text-foreground capitalize">
                  {groupKey === 'openrouter' ? 'OpenRouter' : groupKey} ({groupModels.length})
                </h4>
              </div>
              <div className="grid gap-2">
                {groupModels.map((model) => {
                  const isEnabled = !disabledModels.includes(model.id)
                  return (
                    <div
                      key={model.id}
                      className={cn(
                        'p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-border/40 flex items-center justify-between transition-opacity',
                        !isEnabled && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn('w-2.5 h-2.5 rounded-full', getVendorColor(model.category))} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-foreground truncate">{model.name}</span>
                            {model.isApiKeyOnly && (
                              <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                API Key Required
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{model.description}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {model.features.map((feature) => (
                              <span
                                key={feature}
                                className="text-xs text-rose-500/60 dark:text-rose-300/60 bg-rose-100/50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-full capitalize"
                              >
                                {feature}
                              </span>
                            ))}
                            {model.supportsThinking && (
                              <span className="text-xs text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">
                                Thinking
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => onToggleModel(model.id, checked)}
                        className="ml-3"
                        disabled={model.id === 'gemini-2.0-flash-lite'}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {filteredModels.length === 0 && searchFilter && (
          <p className="text-sm text-center text-muted-foreground py-8">No models found matching "{searchFilter}"</p>
        )}
      </div>
    </SectionWrapper>
  )
}

const LLMProviderKeysSection = ({
  title,
  provider,
  keys,
  onSave,
  onDelete,
  onSetDefault,
}: {
  title: string
  provider: 'gemini' | 'groq' | 'openrouter'
  keys: ApiKey[]
  onSave: (keyData: Partial<ApiKey>) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}) => {
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [editingKey, setEditingKey] = useState<Partial<ApiKey> | null>(null)
  const providerKeys = keys.filter((k) => k.service === provider)

  const handleSave = () => {
    if (editingKey) {
      onSave(editingKey)
      setEditingKey(null)
    }
  }

  const handleAddNew = () => {
    setEditingKey({ service: provider, name: '', key: '' })
  }

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key)
  }

  const handleCancel = () => {
    setEditingKey(null)
  }

  return (
    <SectionWrapper title={title} description={`Manage your API keys for ${title.replace(' Keys', '')}`}>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleAddNew} disabled={!!editingKey}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Key
        </Button>
      </div>

      {editingKey && (
        <InlineKeyForm
          editingKey={editingKey}
          onValueChange={setEditingKey}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      <div className="space-y-2 mt-2">
        {providerKeys.length > 0
          ? providerKeys.map((apiKey) => (
              <div
                key={apiKey._id}
                className="p-2.5 rounded-lg bg-muted/30 backdrop-blur-sm border border-border/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-rose-500" />
                  <div>
                    <div className="font-medium text-sm text-foreground flex items-center gap-2">
                      {apiKey.name}
                      {apiKey.is_default && (
                        <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">Default</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {visibleKeys[apiKey._id] ? apiKey.key : `••••••••••••••••${apiKey.key.slice(-4)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Set as Default"
                    onClick={() => onSetDefault(apiKey._id)}
                    disabled={apiKey.is_default || !!editingKey}
                  >
                    {apiKey.is_default ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={visibleKeys[apiKey._id] ? 'Hide Key' : 'Show Key'}
                    onClick={() => setVisibleKeys((p) => ({ ...p, [apiKey._id]: !p[apiKey._id] }))}
                    disabled={!!editingKey}
                  >
                    {visibleKeys[apiKey._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEdit(apiKey)}
                    disabled={!!editingKey}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500/70 hover:text-red-500"
                    onClick={() => onDelete(apiKey._id)}
                    disabled={!!editingKey}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          : !editingKey && <p className="text-sm text-center text-muted-foreground py-4">No keys added yet.</p>}
      </div>
    </SectionWrapper>
  )
}

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
    if (userSettings) {
      setLocalSettings(userSettings)
    }
  }, [userSettings])

  React.useEffect(() => {
    // Sync optimistic state with server state when it changes
    if (serverDisabledModels.length >= 0) {
      setOptimisticDisabledModels(serverDisabledModels)
    }
  }, [serverDisabledModels])

  const debouncedUpdateSettings = useCallback(
    debounce((settings: Partial<UserSettings>) => {
      updateSettings(settings)
    }, 500),
    [updateSettings],
  )

  const handleSaveSettings = (settings: Partial<UserSettings>) => {
    const newSettings = { ...localSettings, ...settings }
    setLocalSettings(newSettings)
    debouncedUpdateSettings(settings)
  }

  const handleSaveApiKey = async (keyData: Partial<ApiKey>) => {
    const { _id, name, service, key } = keyData
    if (name && service && key) {
      await saveApiKey({ _id, name, service, key })
    }
  }

  const handleDeleteApiKey = async (id: string) => {
    await deleteApiKey({ _id: id as any })
  }

  const handleSetDefault = async (id: string) => {
    await setDefaultApiKey({ _id: id as any })
  }

  const handleModelEnabledChange = (modelId: string, enabled: boolean) => {
    setModelSettings((prev) => ({
      ...prev,
      [modelId]: { enabled },
    }))
  }

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    const currentDisabled = optimisticDisabledModels.length > 0 ? optimisticDisabledModels : serverDisabledModels
    let newDisabledModels: string[]

    if (enabled) {
      // Enable model - remove from disabled list
      newDisabledModels = currentDisabled.filter((id) => id !== modelId)
    } else {
      // Disable model - add to disabled list
      newDisabledModels = [...currentDisabled, modelId]
    }

    // Optimistic update - show change immediately
    setOptimisticDisabledModels(newDisabledModels)

    try {
      await updateDisabledModels({ disabledModels: newDisabledModels })
      // Server update successful, the useEffect will sync the state
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticDisabledModels(currentDisabled)
      console.error('Failed to update model settings:', error)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1 text-foreground">Models & API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Manage your AI models and API keys. Add your own API keys to access premium models and control which models
          appear in your interface.
        </p>
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="models" className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-500/20 blur-sm rounded-full scale-150 -z-10" />
            </div>
            Models
          </TabsTrigger>
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-500/20 blur-sm rounded-full scale-150 -z-10" />
            </div>
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-6">
          <ModelManagementSection disabledModels={disabledModels} onToggleModel={handleToggleModel} />
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/20 blur-sm rounded-full scale-150 -z-10" />
              </div>
              API Keys
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Add your own API keys to access premium models. When available, your keys will be used automatically
              instead of our system keys.
            </p>
          </div>
          <div className="space-y-6 p-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
            <div className="space-y-6">
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
