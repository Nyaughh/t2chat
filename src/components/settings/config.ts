import { User, Database, Brain, Sparkles, Mic } from 'lucide-react'

export const settingsSections = [
  { id: 'account', label: 'My Account', icon: User },
  { id: 'models', label: 'Models & Keys', icon: Brain },
  { id: 'customize', label: 'Customization', icon: Sparkles },
  { id: 'speech', label: 'Speech', icon: Mic },
  { id: 'data', label: 'Manage Data', icon: Database },
] as const

export type SettingsSection = (typeof settingsSections)[number]['id'] 