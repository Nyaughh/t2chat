import { Doc } from '../../../../convex/_generated/dataModel'
import type { PublicApiKey, ApiKeyService } from '../../../../convex/api_keys'

/** A saved key as the client sees it: metadata plus the last 4 characters, never the key itself. */
export type ApiKey = PublicApiKey

/** Form state while adding a key or renaming/replacing one. An empty `key` keeps the stored key. */
export type ApiKeyDraft = {
  _id?: ApiKey['_id']
  service: ApiKeyService
  name: string
  key: string
}
export type UserSettings = Doc<'userSettings'>

export type ModelSettingsState = {
  [modelId: string]: { enabled: boolean }
}

export interface ModelsKeysSettingsProps {
  apiKeys: ApiKey[]
  userSettings: UserSettings | null | undefined
  /** Which half to render: the model on/off list, or the per-provider API keys. */
  view?: 'models' | 'keys'
}

export interface ModelManagementSectionProps {
  disabledModels: string[]
  onToggleModel: (modelId: string, enabled: boolean) => void
}

export interface LLMProviderKeysSectionProps {
  title: string
  description: string
  provider: 'gemini' | 'groq' | 'openrouter' | 'anthropic' | 'openai'
  keyPlaceholder?: string
  keys: ApiKey[]
  onSave: (keyData: ApiKeyDraft) => Promise<boolean>
  onDelete: (id: ApiKey['_id']) => void
  onSetDefault: (id: ApiKey['_id']) => void
}

export interface InlineKeyFormProps {
  editingKey: ApiKeyDraft
  keyPlaceholder?: string
  isSaving?: boolean
  onValueChange: (data: ApiKeyDraft) => void
  onSave: () => void
  onCancel: () => void
}

export interface SectionWrapperProps {
  title: string
  description: string
  children: React.ReactNode
  addKeyButton?: React.ReactNode
} 