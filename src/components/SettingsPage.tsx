'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  X, 
  User, 
  Download,
  Trash2,
  LogOut,
  ChevronRight,
  Key,
  Database,
  Mail,
  Copy,
  Edit3,
  Brain,
  Eye,
  EyeOff,
  Settings,
  Globe,
  Code,
  Zap,
  Sparkles,
  Palette,
  Layout,
  MessageSquare,
  Monitor,
  Moon,
  Sun,
  SendHorizonal,
  ArrowUp,
  MessageCircle,
  Clock,
  Volume2,
  Plus
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

interface SettingsPageProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsSection = 'account' | 'models' | 'customize' | 'data'

interface UserProfile {
  name: string
  email: string
  avatar?: string
  plan: 'free' | 'pro'
}

interface ApiKey {
  id: string
  name: string
  provider: 'gemini' | 'openrouter'
  key: string
}

export default function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account')
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'John Doe',
    email: 'john.doe@example.com',
    plan: 'free'
  })
  
  // Customization options
  const [customization, setCustomization] = useState({
    // User Personalization
    userName: '',
    userRole: '',
    userTraits: [] as string[],
    userAdditionalInfo: '',
    promptTemplate: '',
    
    // Visual Options
    mainFont: 'inter' as 'inter' | 'system' | 'serif' | 'mono',
    codeFont: 'fira-code' as 'fira-code' | 'mono' | 'consolas' | 'jetbrains',
    
    // Behavior
    sendBehavior: 'enter' as 'enter' | 'shiftEnter' | 'button',
    autoSave: true,
    showTimestamps: true
  })
  
  // Input for adding traits
  const [traitInput, setTraitInput] = useState('')

  // Models and API Keys state
  const [modelSettings, setModelSettings] = useState({
    'gemini-2.0-flash': { enabled: true },
    'gemini-2.0-flash-lite': { enabled: true },
    'gemini-2.5-flash': { enabled: true },
    'gemini-2.5-pro': { enabled: false },
    'openrouter/google/gemini-flash-1.5': { enabled: true },
    'openrouter/anthropic/claude-3.5-sonnet': { enabled: true },
    'openrouter/mistralai/mistral-large': { enabled: true },
    'openrouter/openai/gpt-4o': { enabled: true },
  })
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', name: 'My Gemini Key', provider: 'gemini', key: 'gmn_xxxxxxxxxxxxxx' },
    { id: '2', name: 'Personal OpenRouter', provider: 'openrouter', key: 'or_xxxxxxxxxxxxxx' },
  ])
  const [showAddKeyForm, setShowAddKeyForm] = useState(false)
  const [newApiKey, setNewApiKey] = useState({ name: '', provider: 'gemini' as 'gemini' | 'openrouter', key: '' })
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})

  // Model definitions from ai-input.tsx
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

  const settingsSections = [
    { id: 'account', label: 'My Account', icon: User },
    { id: 'models', label: 'Models & Keys', icon: Brain },
    { id: 'customize', label: 'Customization', icon: Sparkles },
    { id: 'data', label: 'Manage Data', icon: Database },
  ]

  const handleSaveApiKey = () => {
    if (editingApiKey) {
      setApiKeys(apiKeys.map(k => k.id === editingApiKey.id ? { ...editingApiKey, ...newApiKey } : k))
    } else {
      setApiKeys([...apiKeys, { ...newApiKey, id: Date.now().toString() }])
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
    setApiKeys(apiKeys.filter(k => k.id !== id))
  }

  const renderModelsSection = () => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 mb-2">API Keys</h3>
          <div className="space-y-2">
            {apiKeys.map(apiKey => (
              <div key={apiKey.id} className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center text-white/80", getProviderColor(apiKey.provider))}>
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-black/80 dark:text-white/80">{apiKey.name}</div>
                    <div className="text-xs text-black/50 dark:text-white/50">
                      {visibleKeys[apiKey.id] ? apiKey.key : `${apiKey.key.substring(0, 3)}...${apiKey.key.substring(apiKey.key.length - 4)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisibleKeys(prev => ({...prev, [apiKey.id]: !prev[apiKey.id]}))}>
                    {visibleKeys[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditApiKey(apiKey)}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500/70 hover:text-red-500" onClick={() => handleDeleteApiKey(apiKey.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {showAddKeyForm ? (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-lg bg-black/5 dark:bg-white/5 mt-3 space-y-3">
              <h4 className="font-semibold text-sm">{editingApiKey ? 'Edit' : 'Add'} API Key</h4>
              <input 
                type="text" 
                placeholder="Key Name (e.g., Personal Key)"
                value={newApiKey.name}
                onChange={(e) => setNewApiKey({...newApiKey, name: e.target.value})}
                className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
              />
              <div className="relative">
                <select 
                  value={newApiKey.provider}
                  onChange={(e) => setNewApiKey({...newApiKey, provider: e.target.value as 'gemini' | 'openrouter'})}
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
                onChange={(e) => setNewApiKey({...newApiKey, key: e.target.value})}
                className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setShowAddKeyForm(false); setEditingApiKey(null); }}>Cancel</Button>
                <Button onClick={handleSaveApiKey}>Save Key</Button>
              </div>
            </motion.div>
          ) : (
            <Button variant="outline" className="mt-3 w-full" onClick={() => { setShowAddKeyForm(true); setEditingApiKey(null); setNewApiKey({ name: '', provider: 'gemini', key: '' }); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add New API Key
            </Button>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 mb-1">Model Preferences</h3>
        </div>

        {Object.entries(
          models.reduce((acc, model) => {
            if (!acc[model.provider]) {
              acc[model.provider] = []
            }
            acc[model.provider].push(model)
            return acc
          }, {} as Record<string, typeof models>)
        ).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-white/80",
                getProviderColor(provider)
              )}>
                <Brain className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold capitalize text-black/70 dark:text-white/70">{provider}</h4>
            </div>

            <div className="space-y-3">
              {providerModels.map((model) => (
                <div key={model.id} className="p-3 rounded-lg bg-black/5 dark:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={(modelSettings[model.id as keyof typeof modelSettings] || {}).enabled}
                            onChange={(e) =>
                              setModelSettings({
                                ...modelSettings,
                                [model.id]: { ...modelSettings[model.id as keyof typeof modelSettings], enabled: e.target.checked },
                              })
                            }
                          />
                          <div className="w-9 h-5 bg-black/20 peer-focus:outline-none rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500/70 dark:peer-checked:bg-rose-400/70"></div>
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
                        <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                          {model.description}
                        </p>
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

  const renderCustomizeSection = () => {
    const handleAddTrait = () => {
      if (traitInput && !customization.userTraits.includes(traitInput)) {
        setCustomization(prev => ({ ...prev, userTraits: [...prev.userTraits, traitInput] }))
        setTraitInput('')
      }
    }

    const handleTraitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTrait()
      }
    }

    const handleRemoveTrait = (index: number) => {
      setCustomization(prev => ({
        ...prev,
        userTraits: prev.userTraits.filter((_, i) => i !== index)
      }))
    }

    const CustomizationInput = ({ id, label, value, onChange, placeholder, isTextArea = false, rows = 3 }: { id: string, label: string, value: string, onChange: (e: any) => void, placeholder: string, isTextArea?: boolean, rows?: number }) => (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
          {label}
        </label>
        {isTextArea ? (
          <textarea
            id={id}
            rows={rows}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none resize-y"
          />
        ) : (
          <input
            type="text"
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none"
          />
        )}
      </div>
    )

    const CustomizationSelect = ({ id, label, value, onChange, children }: { id: string, label: string, value: string, onChange: (e: any) => void, children: React.ReactNode }) => (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
          {label}
        </label>
        <div className="relative">
          <select
            id={id}
            value={value}
            onChange={onChange}
            className="w-full appearance-none bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md pl-3 pr-8 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none"
          >
            {children}
          </select>
          <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40 pointer-events-none" />
        </div>
      </div>
    )

    const CustomizationRadio = ({ name, value, checked, onChange, label, icon: Icon }: { name: string, value: string, checked: boolean, onChange: (e: any) => void, label: string, icon: React.ElementType }) => (
      <label className={cn(
        "flex items-center gap-2 p-2 rounded-md cursor-pointer border transition-colors",
        checked ? "bg-rose-500/10 border-rose-500/30" : "bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10"
      )}>
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <Icon className={cn("w-4 h-4", checked ? "text-rose-600 dark:text-rose-400" : "text-black/60 dark:text-white/60")} />
        <span className={cn("text-sm", checked ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-black/80 dark:text-white/80")}>{label}</span>
      </label>
    )

    return (
      <div className="space-y-8">
        {/* User Personalization Section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
            <User className="w-5 h-5" />
            User Personalization
          </h3>
          <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <CustomizationInput 
              id="userName" 
              label="Your Name" 
              value={customization.userName} 
              onChange={e => setCustomization({...customization, userName: e.target.value})}
              placeholder="e.g., Jane Doe"
            />
            <CustomizationInput 
              id="userRole" 
              label="Your Role/Profession" 
              value={customization.userRole} 
              onChange={e => setCustomization({...customization, userRole: e.target.value})}
              placeholder="e.g., Software Engineer, Student, etc."
            />
            <div>
              <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                Your Interests/Traits
              </label>
              <div className="flex flex-wrap gap-2">
                {customization.userTraits.map((trait, index) => (
                  <div key={index} className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300 rounded-full pl-2 pr-1 py-0.5 text-xs">
                    <span>{trait}</span>
                    <button onClick={() => handleRemoveTrait(index)} className="text-rose-600/70 dark:text-rose-300/70 hover:text-rose-600 dark:hover:text-rose-300">
                      <X className="w-3 h-3"/>
                    </button>
                  </div>
                ))}
              </div>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={traitInput}
                  onChange={e => setTraitInput(e.target.value)}
                  onKeyDown={handleTraitKeyDown}
                  placeholder="Add a trait and press Enter..."
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-400 focus:border-rose-500 dark:focus:border-rose-400 outline-none"
                />
                <button onClick={handleAddTrait} className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-50" disabled={!traitInput}>
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
            <CustomizationInput 
              id="userAdditionalInfo" 
              label="Additional Information" 
              value={customization.userAdditionalInfo} 
              onChange={e => setCustomization({...customization, userAdditionalInfo: e.target.value})}
              placeholder="Anything else you want the AI to know about you?"
              isTextArea
            />
          </div>
        </div>

        {/* Prompt Template Section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            Prompt Template
          </h3>
          <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <CustomizationInput 
              id="promptTemplate"
              label="System Prompt"
              value={customization.promptTemplate}
              onChange={e => setCustomization({...customization, promptTemplate: e.target.value})}
              placeholder="e.g., You are a helpful and friendly assistant. Always respond in Markdown."
              isTextArea
              rows={5}
            />
          </div>
        </div>

        {/* Visual Options Section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5" />
            Appearance
          </h3>
          <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <CustomizationSelect 
              id="mainFont"
              label="Main Font"
              value={customization.mainFont}
              onChange={e => setCustomization({...customization, mainFont: e.target.value})}
            >
              <option value="inter">Inter (Default)</option>
              <option value="system">System UI</option>
              <option value="serif">Serif</option>
              <option value="mono">Monospace</option>
            </CustomizationSelect>

            <CustomizationSelect
              id="codeFont"
              label="Code Font"
              value={customization.codeFont}
              onChange={e => setCustomization({...customization, codeFont: e.target.value})}
            >
              <option value="fira-code">Fira Code (Default)</option>
              <option value="mono">System Mono</option>
              <option value="consolas">Consolas</option>
              <option value="jetbrains">JetBrains Mono</option>
            </CustomizationSelect>
          </div>
        </div>
        
        {/* Behavior Section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80 flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5" />
            Behavior
          </h3>
          <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <div>
              <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
                Send Message on Enter
              </label>
              <div className="grid grid-cols-3 gap-2">
                <CustomizationRadio
                  name="sendBehavior"
                  value="enter"
                  checked={customization.sendBehavior === 'enter'}
                  onChange={e => setCustomization({...customization, sendBehavior: e.target.value})}
                  label="Enter"
                  icon={SendHorizonal}
                />
                <CustomizationRadio
                  name="sendBehavior"
                  value="shiftEnter"
                  checked={customization.sendBehavior === 'shiftEnter'}
                  onChange={e => setCustomization({...customization, sendBehavior: e.target.value})}
                  label="Shift+Enter"
                  icon={ArrowUp}
                />
                <CustomizationRadio
                  name="sendBehavior"
                  value="button"
                  checked={customization.sendBehavior === 'button'}
                  onChange={e => setCustomization({...customization, sendBehavior: e.target.value})}
                  label="Button Only"
                  icon={MessageCircle}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="autoSave" className="block text-sm font-medium text-black/70 dark:text-white/70">
                  Auto-save conversations
                </label>
                <p className="text-xs text-black/50 dark:text-white/50">
                  Automatically save chat history.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="autoSave"
                  className="sr-only peer"
                  checked={customization.autoSave}
                  onChange={e => setCustomization({...customization, autoSave: e.target.checked})}
                />
                <div className="w-9 h-5 bg-black/20 peer-focus:outline-none rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500/70 dark:peer-checked:bg-rose-400/70"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="showTimestamps" className="block text-sm font-medium text-black/70 dark:text-white/70">
                  Show message timestamps
                </label>
                <p className="text-xs text-black/50 dark:text-white/50">
                  Display the time for each message.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="showTimestamps"
                  className="sr-only peer"
                  checked={customization.showTimestamps}
                  onChange={e => setCustomization({...customization, showTimestamps: e.target.checked})}
                />
                <div className="w-9 h-5 bg-black/20 peer-focus:outline-none rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500/70 dark:peer-checked:bg-rose-400/70"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderDataSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">Manage Data</h3>
      </div>
      <div className="space-y-3">
        <Button variant="outline" className="w-full justify-start text-base">
          <Download className="w-4 h-4 mr-3" />
          Export All Conversations
        </Button>
        <Button variant="outline" className="w-full justify-start text-base">
          <Trash2 className="w-4 h-4 mr-3" />
          Delete All Conversations
        </Button>
      </div>
       <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
          <Trash2 className="w-4 h-4"/>
          Danger Zone
        </h4>
        <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-1 mb-3">
          Deleting your conversations is a permanent action and cannot be undone.
        </p>
        <Button variant="destructive" className="w-full text-sm">
          I understand, delete all my data
        </Button>
      </div>
    </div>
  )

  const renderAccountSection = () => (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* User profile section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Profile</h3>
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/5 border border-rose-500/10 dark:border-rose-300/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-300 dark:to-rose-400 flex items-center justify-center text-white text-xl font-bold">
                {userProfile.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base text-black/80 dark:text-white/80">{userProfile.name}</div>
                <div className="text-sm text-black/60 dark:text-white/60">{userProfile.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Plan section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Plan</h3>
          <div className="mt-3 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base text-black/80 dark:text-white/80 capitalize">{userProfile.plan} Plan</div>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {userProfile.plan === 'free' ? 'Unlock more features with Pro.' : 'You have access to all features.'}
                </p>
              </div>
              <Button>
                {userProfile.plan === 'free' ? 'Upgrade to Pro' : 'Manage Subscription'}
              </Button>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start text-base">
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </motion.div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return renderAccountSection()
      case 'models':
        return renderModelsSection()
      case 'customize':
        return renderCustomizeSection()
      case 'data':
        return renderDataSection()
      default:
        return null
    }
  }

  const isMobile = useIsMobile()

  if (!isOpen) return null

  const SettingsPanelContent = () => (
    <>
      <header className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h2 className="text-lg font-bold text-black/80 dark:text-white/80">Settings</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-black/50 dark:text-white/50">
          <X className="w-5 h-5" />
        </Button>
      </header>

      <div className={cn(
        "flex flex-1 min-h-0",
        isMobile && "flex-col"
      )}>
        {/* Sidebar for Desktop, Tabs for Mobile */}
        <aside className={cn(
          "flex-shrink-0",
          isMobile 
            ? "p-2 border-b border-black/10 dark:border-white/10" 
            : "w-56 p-4 border-r border-black/10 dark:border-white/10"
        )}>
          <nav className={cn(
            "flex",
            isMobile 
              ? "flex-row space-x-1 overflow-x-auto scrollbar-hide" 
              : "flex-col space-y-1"
          )}>
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as SettingsSection)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors',
                  activeSection === section.id
                    ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300 font-semibold'
                    : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5',
                  isMobile ? "justify-center" : "w-full text-left"
                )}
              >
                <section.icon className="w-4 h-4" />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 dark:bg-black/60 z-50 flex items-center justify-center"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-[oklch(0.15_0.02_25)] w-[90vw] h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-black/10 dark:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <SettingsPanelContent />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border-l border-rose-500/10 dark:border-white/10 z-50 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SettingsPanelContent />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 