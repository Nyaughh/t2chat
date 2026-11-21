import { User, Database, Brain, KeyRound, Sparkles, Mic } from 'lucide-react'

export const settingsSections = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'customize', label: 'Customization', icon: Sparkles },
  { id: 'models', label: 'Models', icon: Brain },
  { id: 'keys', label: 'API Keys', icon: KeyRound },
  { id: 'speech', label: 'Speech', icon: Mic },
  { id: 'data', label: 'Data', icon: Database },
] as const

export type SettingsSection = (typeof settingsSections)[number]['id']

export const DEFAULT_SETTINGS_SECTION: SettingsSection = 'account'

/** Narrow an untrusted value (e.g. a `?tab=` query param) to a known section. */
export function parseSettingsSection(value: string | null | undefined): SettingsSection | null {
  if (!value) return null
  return settingsSections.some((section) => section.id === value) ? (value as SettingsSection) : null
}
