import { Doc } from '../../../../convex/_generated/dataModel'

export type ApiKey = Doc<'apiKeys'>
export type UserSettings = Doc<'userSettings'>

export type ModelSettingsState = {
  [modelId: string]: { enabled: boolean }
}

export interface ModelsKeysSettingsProps {
  apiKeys: ApiKey[]
  userSettings: UserSettings | null | undefined
}

export interface ModelManagementSectionProps {
  disabledModels: string[]
  onToggleModel: (modelId: string, enabled: boolean) => void
}

export interface LLMProviderKeysSectionProps {
  title: string
  provider: 'gemini' | 'groq' | 'openrouter'
  keys: ApiKey[]
  onSave: (keyData: Partial<ApiKey>) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}

export interface InlineKeyFormProps {
  editingKey: Partial<ApiKey>
  onValueChange: (data: Partial<ApiKey>) => void
  onSave: () => void
  onCancel: () => void
}

export interface SectionWrapperProps {
  title: string
  description: string
  children: React.ReactNode
  addKeyButton?: React.ReactNode
} 