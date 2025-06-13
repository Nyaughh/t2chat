import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Key, Brain, Eye, EyeOff, Edit3, Trash2, ChevronRight, Plus } from 'lucide-react'

// types
export interface ApiKey {
  id: string
  name: string
  provider: 'gemini' | 'openrouter'
  key: string
}

export type ModelSettingsState = {
  'gemini-2.0-flash': { enabled: boolean }
  'gemini-2.0-flash-lite': { enabled: boolean }
  'gemini-2.5-flash': { enabled: boolean }
  'gemini-2.5-pro': { enabled: boolean }
  'openrouter/google/gemini-flash-1.5': { enabled: boolean }
  'openrouter/anthropic/claude-3.5-sonnet': { enabled: boolean }
  'openrouter/mistralai/mistral-large': { enabled: boolean }
  'openrouter/openai/gpt-4o': { enabled: boolean }
}

// constants
const models = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Latest and fastest model',
    provider: 'gemini',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Lightweight version for quick tasks',
    provider: 'gemini',
    features: ['vision', 'code'],
    isPro: false,
    isNew: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Advanced reasoning capabilities',
    provider: 'gemini',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Most capable model for complex tasks',
    provider: 'gemini',
    features: ['vision', 'web', 'code'],
    isPro: true,
    supportsThinking: true,
  },
  {
    id: 'openrouter/google/gemini-flash-1.5',
    name: 'Google: Gemini Flash 1.5',
    description: 'OpenRouter-hosted Gemini Flash 1.5',
    provider: 'openrouter',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'openrouter/anthropic/claude-3.5-sonnet',
    name: 'Anthropic: Claude 3.5 Sonnet',
    description: 'OpenRouter-hosted Claude 3.5 Sonnet',
    provider: 'openrouter',
    features: ['vision', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'openrouter/mistralai/mistral-large',
    name: 'Mistral: Mistral Large',
    description: 'OpenRouter-hosted Mistral Large',
    provider: 'openrouter',
    features: ['web', 'code'],
    isPro: false,
  },
  {
    id: 'openrouter/openai/gpt-4o',
    name: 'OpenAI: GPT-4o',
    description: 'OpenRouter-hosted GPT-4o',
    provider: 'openrouter',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: true,
  },
]

const getProviderColor = (provider: string) => {
  switch (provider) {
    case 'gemini':
      return 'bg-red-500'
    case 'gpt':
      return 'bg-green-500'
    case 'claude':
      return 'bg-orange-500'
    case 'o-series':
      return 'bg-purple-500'
    case 'llama':
      return 'bg-yellow-500'
    case 'openrouter':
      return 'bg-blue-500'
    default:
      return 'bg-gray-500'
  }
}

interface ModelsSettingsProps {
  apiKeys: ApiKey[]
  modelSettings: ModelSettingsState
}

export function ModelsSettings({ apiKeys, modelSettings }: ModelsSettingsProps) {
  const [showAddKeyForm, setShowAddKeyForm] = useState(false)
  const [newApiKey, setNewApiKey] = useState({ name: '', provider: 'gemini' as 'gemini' | 'openrouter', key: '' })
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [localApiKeys, setLocalApiKeys] = useState<ApiKey[]>(apiKeys)
  const [localModelSettings, setLocalModelSettings] = useState<ModelSettingsState>(modelSettings)

  const handleSaveApiKey = () => {
    if (editingApiKey) {
      setLocalApiKeys(localApiKeys.map((k) => (k.id === editingApiKey.id ? { ...editingApiKey, ...newApiKey } : k)))
    } else {
      setLocalApiKeys([...localApiKeys, { ...newApiKey, id: Date.now().toString() }])
    }
    setNewApiKey({ name: '', provider: 'gemini', key: '' })
    setEditingApiKey(null)
    setShowAddKeyForm(false)
  }

  const handleEditApiKey = (key: ApiKey) => {
    setEditingApiKey(key)
    setNewApiKey({ name: key.name, provider: key.provider, key: key.key })
    setShowAddKeyForm(true)
  }

  const handleDeleteApiKey = (id: string) => {
    setLocalApiKeys(localApiKeys.filter((k) => k.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 mb-2">API Keys</h3>
        <div className="space-y-2">
          {localApiKeys.map((apiKey) => (
            <div
              key={apiKey.id}
              className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center text-white/80',
                    getProviderColor(apiKey.provider),
                  )}
                >
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-sm text-black/80 dark:text-white/80">{apiKey.name}</div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    {visibleKeys[apiKey.id]
                      ? apiKey.key
                      : `${apiKey.key.substring(0, 3)}...${apiKey.key.substring(apiKey.key.length - 4)}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setVisibleKeys((prev) => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                >
                  {visibleKeys[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditApiKey(apiKey)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500/70 hover:text-red-500"
                  onClick={() => handleDeleteApiKey(apiKey.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {showAddKeyForm ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="p-4 rounded-lg bg-black/5 dark:bg-white/5 mt-3 space-y-3"
          >
            <h4 className="font-semibold text-sm">{editingApiKey ? 'Edit' : 'Add'} API Key</h4>
            <input
              type="text"
              placeholder="Key Name (e.g., Personal Key)"
              value={newApiKey.name}
              onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
              className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
            />
            <div className="relative">
              <select
                value={newApiKey.provider}
                onChange={(e) => setNewApiKey({ ...newApiKey, provider: e.target.value as 'gemini' | 'openrouter' })}
                className="w-full appearance-none bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
              >
                <option value="gemini">Gemini</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40 pointer-events-none" />
            </div>
            <input
              type="password"
              placeholder="API Key"
              value={newApiKey.key}
              onChange={(e) => setNewApiKey({ ...newApiKey, key: e.target.value })}
              className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddKeyForm(false)
                  setEditingApiKey(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveApiKey}>Save Key</Button>
            </div>
          </motion.div>
        ) : (
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => {
              setShowAddKeyForm(true)
              setEditingApiKey(null)
              setNewApiKey({ name: '', provider: 'gemini', key: '' })
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New API Key
          </Button>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 mb-1">Model Preferences</h3>
      </div>

      {Object.entries(
        models.reduce(
          (acc, model) => {
            if (!acc[model.provider]) {
              acc[model.provider] = []
            }
            acc[model.provider].push(model)
            return acc
          },
          {} as Record<string, typeof models>,
        ),
      ).map(([provider, providerModels]) => (
        <div key={provider}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-white/80',
                getProviderColor(provider),
              )}
            >
              <Brain className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold capitalize text-black/70 dark:text-white/70">{provider}</h4>
          </div>

          <div className="space-y-3">
            {providerModels.map((model) => (
              <div key={model.id} className="p-3 rounded-lg bg-black/5 dark:bg-white/5 transition-all duration-150 ease-[0.25,1,0.5,1] hover:bg-black/8 dark:hover:bg-white/8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={(modelSettings[model.id as keyof typeof modelSettings] || {}).enabled}
                          onChange={(e) =>
                            setLocalModelSettings({
                              ...localModelSettings,
                              [model.id]: {
                                ...localModelSettings[model.id as keyof typeof localModelSettings],
                                enabled: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-9 h-5 bg-black/20 peer-focus:outline-none rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all after:duration-150 after:ease-[0.25,1,0.5,1] dark:border-gray-600 peer-checked:bg-rose-500/70 dark:peer-checked:bg-rose-400/70"></div>
                      </label>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-black/80 dark:text-white/80">{model.name}</span>
                        {model.isPro && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300 rounded-full">
                            Pro
                          </span>
                        )}
                        {model.isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:bg-sky-300/10 dark:text-sky-300 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">{model.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
