import React, { useState, useCallback } from 'react';
import { Doc } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Key,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  CheckCircle,
  Circle,
  UploadCloud,
  Search,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { debounce } from 'lodash';

export type ApiKey = Doc<"apiKeys">;
export type UserSettings = Doc<"userSettings">;

export type ModelSettingsState = {
  [modelId: string]: { enabled: boolean }
}

interface ModelsKeysSettingsProps {
  apiKeys: ApiKey[];
  userSettings: UserSettings | null | undefined;
  onSettingsChange: (settings: Partial<UserSettings>) => void;
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
    <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">{title}</h3>
    <p className="text-sm text-black/60 dark:text-white/60 mb-4">{description}</p>
    <div className="space-y-4 rounded-lg bg-black/5 dark:bg-white/5 p-4">{children}</div>
  </div>
)

const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={cn(
      'relative w-10 h-5 rounded-full transition-colors duration-200',
      enabled ? 'bg-rose-500 dark:bg-rose-400' : 'bg-gray-300 dark:bg-gray-700',
    )}
  >
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 700, damping: 30 }}
      className={cn(
        'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full',
        enabled ? 'translate-x-5' : 'translate-x-0',
      )}
    />
  </button>
)

const ServiceKeyRow = ({
  icon,
  label,
  value,
  onValueChange,
  enabled,
  onEnabledChange,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onValueChange: (value: string) => void
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}) => {
  const [showKey, setShowKey] = useState(false)
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
      <div className="flex items-center gap-3 mb-2 sm:mb-0">
        {icon}
        <span className="font-medium text-black/80 dark:text-white/80">{label}</span>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-grow">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder="Paste your key here"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            disabled={!enabled}
            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm transition-opacity duration-200 disabled:opacity-50 pr-8"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <ToggleSwitch enabled={enabled} onChange={onEnabledChange} />
      </div>
    </div>
  )
}

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
      className="p-4 rounded-lg bg-black/10 dark:bg-white/10 mt-2 space-y-3"
    >
        <h4 className="font-semibold text-sm">{editingKey._id ? 'Edit' : 'Add New'} Key</h4>
        <input
            type="text"
            placeholder="Key Name (e.g., Personal Key)"
            value={editingKey.name || ''}
            onChange={(e) => onValueChange({ ...editingKey, name: e.target.value })}
            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
        />
        <input
            type="password"
            placeholder="API Key"
            value={editingKey.key || ''}
            onChange={(e) => onValueChange({ ...editingKey, key: e.target.value })}
            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
        />
        <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={onSave}>Save Key</Button>
        </div>
    </motion.div>
  );

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
    <SectionWrapper
      title={title}
      description={`Manage your API keys for ${title.replace(' Keys', '')}. You can set one as default.`}
    >
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
        {providerKeys.length > 0 ? (
          providerKeys.map((apiKey) => (
            <div
              key={apiKey._id}
              className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-rose-500" />
                <div>
                  <div className="font-medium text-sm text-black/80 dark:text-white/80 flex items-center gap-2">
                    {apiKey.name}
                    {apiKey.is_default && (
                      <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">Default</span>
                    )}
                  </div>
                  <div className="text-xs text-black/50 dark:text-white/50">
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
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(apiKey)} disabled={!!editingKey}>
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
        ) : (
          !editingKey && <p className="text-sm text-center text-black/50 dark:text-white/50 py-4">No keys added yet.</p>
        )}
      </div>
    </SectionWrapper>
  )
}

export function ModelsKeysSettings({ apiKeys, userSettings, onSettingsChange }: ModelsKeysSettingsProps) {
  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({})
  const [modelSettings, setModelSettings] = useState<ModelSettingsState>({})

  const updateSettings = useMutation(api.users.updateUserSettings)
  const saveApiKey = useMutation(api.api_keys.saveApiKey)
  const deleteApiKey = useMutation(api.api_keys.deleteApiKey)
  const setDefaultApiKey = useMutation(api.api_keys.setDefaultApiKey)

  React.useEffect(() => {
    if (userSettings) {
      setLocalSettings(userSettings)
    }
  }, [userSettings])

  const debouncedSettingsChange = useCallback(
    debounce((settings: Partial<UserSettings>) => {
      onSettingsChange(settings)
    }, 500),
    [onSettingsChange]
  );

  const handleSaveSettings = (settings: Partial<UserSettings>) => {
    const newSettings = { ...localSettings, ...settings }
    setLocalSettings(newSettings)
    debouncedSettingsChange(settings);
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
      [modelId]: { enabled }
    }))
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1 text-black/90 dark:text-white/90">Models & Keys</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Provide your own API keys to use premium models and services. This is optional.
        </p>
      </div>

      <SectionWrapper
        title="Service Keys"
        description="Keys for optional services like file uploads and web search."
      >
        <ServiceKeyRow
          icon={<UploadCloud className="w-5 h-5 text-fuchsia-500" />}
          label="UploadThing"
          value={userSettings?.uploadthing_key || ''}
          onValueChange={(v) => handleSaveSettings({ uploadthing_key: v })}
          enabled={userSettings?.use_keys_for_uploadthing ?? false}
          onEnabledChange={(e) => handleSaveSettings({ use_keys_for_uploadthing: e })}
        />
        <ServiceKeyRow
          icon={<Search className="w-5 h-5 text-sky-500" />}
          label="Tavily API"
          value={userSettings?.tavily_key || ''}
          onValueChange={(v) => handleSaveSettings({ tavily_key: v })}
          enabled={userSettings?.use_keys_for_tavily ?? false}
          onEnabledChange={(e) => handleSaveSettings({ use_keys_for_tavily: e })}
        />
      </SectionWrapper>

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
  )
} 