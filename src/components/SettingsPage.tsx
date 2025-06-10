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
  Bell,
  Volume2
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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

export default function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account')
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'John Doe',
    email: 'john.doe@example.com',
    plan: 'free'
  })
  


  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [tempProfile, setTempProfile] = useState(userProfile)

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
    'gemini-2.0-flash': { enabled: true, hasCustomKey: false },
    'gemini-2.0-flash-lite': { enabled: true, hasCustomKey: false },
    'gemini-2.5-flash': { enabled: true, hasCustomKey: false },
    'gemini-2.5-pro': { enabled: false, hasCustomKey: false },
    'gpt-imagegen': { enabled: false, hasCustomKey: false },
    'gpt-4o-mini': { enabled: true, hasCustomKey: false },
    'gpt-4o': { enabled: true, hasCustomKey: false },
    'gpt-4.1': { enabled: true, hasCustomKey: false },
    'gpt-4.1-mini': { enabled: true, hasCustomKey: false },
    'gpt-4.1-nano': { enabled: true, hasCustomKey: false },
    'o3-mini': { enabled: true, hasCustomKey: false },
    'o4-mini': { enabled: true, hasCustomKey: false },
    'o3': { enabled: true, hasCustomKey: false },
    'claude-3.5-sonnet': { enabled: true, hasCustomKey: false },
    'claude-3.7-sonnet': { enabled: true, hasCustomKey: false },
    'claude-4-sonnet': { enabled: false, hasCustomKey: false },
    'claude-4-opus': { enabled: false, hasCustomKey: false },
    'llama-3.3-70b': { enabled: true, hasCustomKey: false },
  })

  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    gpt: '',
    claude: '',
    'o-series': '',
    llama: '',
  })

  const [showApiKeys, setShowApiKeys] = useState({
    gemini: false,
    gpt: false,
    claude: false,
    'o-series': false,
    llama: false,
  })

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
      id: 'gpt-imagegen',
      name: 'GPT ImageGen',
      description: 'Specialized for image generation',
      provider: 'gpt',
      features: ['vision'],
      isPro: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT 4o-mini',
      description: 'Compact and efficient',
      provider: 'gpt',
      features: ['vision'],
      isPro: false,
    },
    {
      id: 'gpt-4o',
      name: 'GPT 4o',
      description: 'Omni-modal capabilities',
      provider: 'gpt',
      features: ['vision'],
      isPro: false,
      supportsThinking: true,
    },
    {
      id: 'gpt-4.1',
      name: 'GPT 4.1',
      description: 'Enhanced reasoning model',
      provider: 'gpt',
      features: ['vision'],
      isPro: false,
      supportsThinking: true,
    },
    {
      id: 'gpt-4.1-mini',
      name: 'GPT 4.1 Mini',
      description: 'Lightweight reasoning model',
      provider: 'gpt',
      features: ['vision'],
      isPro: false,
    },
    {
      id: 'gpt-4.1-nano',
      name: 'GPT 4.1 Nano',
      description: 'Ultra-fast responses',
      provider: 'gpt',
      features: ['vision'],
      isPro: false,
    },
    {
      id: 'o3-mini',
      name: 'o3 mini',
      description: 'Advanced reasoning in compact form',
      provider: 'o-series',
      features: ['web', 'code'],
      isPro: false,
    },
    {
      id: 'o4-mini',
      name: 'o4 mini',
      description: 'Next-gen reasoning model',
      provider: 'o-series',
      features: ['vision', 'web'],
      isPro: false,
      supportsThinking: true,
    },
    {
      id: 'o3',
      name: 'o3',
      description: 'Powerful reasoning capabilities',
      provider: 'o-series',
      features: ['vision', 'web'],
      isPro: false,
      supportsThinking: true,
    },
    {
      id: 'claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Balanced performance and speed',
      provider: 'claude',
      features: ['vision', 'code'],
      isPro: false,
      supportsThinking: true,
    },
    {
      id: 'claude-3.7-sonnet',
      name: 'Claude 3.7 Sonnet',
      description: 'Enhanced writing and analysis',
      provider: 'claude',
      features: ['vision', 'code'],
      isPro: false,
      supportsThinking: true,
    },
    {
      id: 'claude-4-sonnet',
      name: 'Claude 4 Sonnet',
      description: 'Latest Claude capabilities',
      provider: 'claude',
      features: ['vision', 'code'],
      isPro: true,
      supportsThinking: true,
    },
    {
      id: 'claude-4-opus',
      name: 'Claude 4 Opus',
      description: 'Most capable Claude model',
      provider: 'claude',
      features: ['vision', 'code'],
      isPro: true,
      supportsThinking: true,
    },
    {
      id: 'llama-3.3-70b',
      name: 'Llama 3.3 70b',
      description: 'Open-source excellence',
      provider: 'llama',
      features: ['code'],
      isPro: false,
      isNew: true,
      supportsThinking: true,
    },
  ]

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'gemini':
        return 'from-blue-500 to-purple-500'
      case 'gpt':
        return 'from-green-500 to-teal-500'
      case 'claude':
        return 'from-purple-500 to-pink-500'
      case 'o-series':
        return 'from-orange-500 to-red-500'
      case 'llama':
        return 'from-indigo-500 to-blue-500'
      default:
        return 'from-gray-500 to-gray-600'
    }
  }

  const settingsSections = [
    { id: 'account' as const, label: 'Account', icon: User },
    { id: 'models' as const, label: 'Models & API Keys', icon: Brain },
    { id: 'customize' as const, label: 'Customize', icon: Palette },
    { id: 'data' as const, label: 'Data & Storage', icon: Database },
  ]

  const handleProfileSave = () => {
    setUserProfile(tempProfile)
    setIsEditingProfile(false)
  }

  const handleProfileCancel = () => {
    setTempProfile(userProfile)
    setIsEditingProfile(false)
  }



  

  const renderModelsSection = () => {
    const groupedModels = models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    }, {} as Record<string, typeof models>)

    const providerNames = {
      gemini: 'Google Gemini',
      gpt: 'OpenAI GPT',
      claude: 'Anthropic Claude',
      'o-series': 'OpenAI o-series',
      llama: 'Meta Llama',
    }

    return (
      <div className="space-y-8">
                 {/* API Keys Section */}
         <div>
           <h3 className="text-lg font-semibold text-black dark:text-white mb-4">API Keys</h3>
           <p className="text-sm text-black/60 dark:text-white/60 mb-5">
             Connect your own API keys for personal rate limits and billing.
           </p>
           
           <div className="grid gap-3">
             {Object.entries(providerNames).map(([provider, displayName]) => (
               <div key={provider} className="flex items-center gap-3">
                 <div className={cn('w-2 h-2 rounded-full bg-gradient-to-r', getProviderColor(provider))}></div>
                 <div className="min-w-[120px]">
                   <span className="text-sm font-medium text-black dark:text-white">{displayName}</span>
                 </div>
                 
                 <div className="relative flex-1">
                   <input
                     type={showApiKeys[provider as keyof typeof showApiKeys] ? 'text' : 'password'}
                     value={apiKeys[provider as keyof typeof apiKeys]}
                     onChange={(e) => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                     placeholder="API key"
                     className="w-full px-3 py-1.5 pr-7 text-sm rounded bg-white/40 dark:bg-[oklch(0.18_0.015_25)]/30 border border-rose-200/30 dark:border-rose-500/10 focus:border-rose-500/50 dark:focus:border-rose-300/50 focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/30"
                   />
                   <button
                     onClick={() => setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider as keyof typeof prev] }))}
                     className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors"
                   >
                     {showApiKeys[provider as keyof typeof showApiKeys] ? (
                       <EyeOff className="w-3.5 h-3.5" />
                     ) : (
                       <Eye className="w-3.5 h-3.5" />
                     )}
                   </button>
                 </div>
                 
                 <div>
                   {apiKeys[provider as keyof typeof apiKeys] ? (
                     <div className="w-2 h-2 rounded-full bg-green-500"></div>
                   ) : (
                     <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                   )}
                 </div>
               </div>
             ))}
           </div>
         </div>

                 {/* Models Configuration */}
         <div>
           <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Models</h3>
           <p className="text-sm text-black/60 dark:text-white/60 mb-5">
             Enable or disable models in your chat interface.
           </p>

           <div className="space-y-5">
             {Object.entries(groupedModels).map(([provider, providerModels]) => (
               <div key={provider} className="space-y-2">
                 <div className="flex items-center gap-2 mb-2">
                   <div className={cn('w-2 h-2 rounded-full bg-gradient-to-r', getProviderColor(provider))}></div>
                   <h4 className="text-sm font-medium text-black dark:text-white">{providerNames[provider as keyof typeof providerNames]}</h4>
                 </div>
                 
                 <div className="space-y-1.5">
                   {providerModels.map((model) => (
                     <div key={model.id} className="flex items-center justify-between px-3 py-2 rounded border border-rose-100/30 dark:border-rose-500/10">
                       <div className="flex-1 min-w-0 pr-3">
                         <div className="flex items-center gap-1.5">
                           <span className="text-sm text-black dark:text-white truncate">
                             {model.name}
                           </span>
                           {model.isNew && (
                             <span className="text-[10px] leading-none px-1 py-0.5 rounded-sm bg-rose-100/50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300">
                               New
                             </span>
                           )}
                           {model.isPro && (
                             <span className="text-[10px] leading-none px-1 py-0.5 rounded-sm bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                               Pro
                             </span>
                           )}
                         </div>
                         
                         <div className="flex items-center gap-2 mt-0.5">
                           {model.features.includes('vision') && <Eye className="w-2.5 h-2.5 text-black/30 dark:text-white/30" />}
                           {model.features.includes('web') && <Globe className="w-2.5 h-2.5 text-black/30 dark:text-white/30" />}
                           {model.features.includes('code') && <Code className="w-2.5 h-2.5 text-black/30 dark:text-white/30" />}
                           {model.supportsThinking && <Zap className="w-2.5 h-2.5 text-black/30 dark:text-white/30" />}
                         </div>
                       </div>
                       
                       <button
                         onClick={() => setModelSettings(prev => ({
                           ...prev,
                           [model.id]: {
                             ...prev[model.id as keyof typeof prev],
                             enabled: !prev[model.id as keyof typeof prev]?.enabled
                           }
                         }))}
                         className={cn(
                           'w-9 h-5 rounded-full transition-colors relative',
                           modelSettings[model.id as keyof typeof modelSettings]?.enabled
                             ? 'bg-rose-500'
                             : 'bg-gray-300 dark:bg-gray-600'
                         )}
                       >
                         <div className={cn(
                           'w-4 h-4 rounded-full bg-white shadow-sm transition-transform absolute top-0.5',
                           modelSettings[model.id as keyof typeof modelSettings]?.enabled
                             ? 'translate-x-4'
                             : 'translate-x-0.5'
                         )} />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
           </div>
         </div>

                 {/* Quick Actions */}
         <div className="flex gap-2.5 pt-1">
           <button
             onClick={() => {
               setModelSettings(prev => {
                 const updated = { ...prev }
                 Object.keys(updated).forEach(key => {
                   updated[key as keyof typeof updated] = { ...updated[key as keyof typeof updated], enabled: true }
                 })
                 return updated
               })
             }}
             className="px-3 py-1.5 text-xs bg-rose-500/90 text-white rounded hover:bg-rose-500 transition-colors"
           >
             Enable All Models
           </button>
           <button
             onClick={() => {
               setModelSettings(prev => {
                 const updated = { ...prev }
                 Object.keys(updated).forEach(key => {
                   updated[key as keyof typeof updated] = { ...updated[key as keyof typeof updated], enabled: false }
                 })
                 return updated
               })
             }}
             className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
           >
             Disable All
           </button>
         </div>
      </div>
    )
  }

  const renderCustomizeSection = () => {
    // Handle adding a new trait
    const handleAddTrait = () => {
      if (traitInput.trim() && customization.userTraits.length < 50 && traitInput.length <= 100) {
        setCustomization(prev => ({
          ...prev,
          userTraits: [...prev.userTraits, traitInput.trim()]
        }));
        setTraitInput('');
      }
    };

    // Handle trait input key press
    const handleTraitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === 'Enter' || e.key === 'Tab') && traitInput.trim()) {
        e.preventDefault();
        handleAddTrait();
      }
    };

    // Handle removing a trait
    const handleRemoveTrait = (index: number) => {
      setCustomization(prev => ({
        ...prev,
        userTraits: prev.userTraits.filter((_, i) => i !== index)
      }));
    };

    return (
      <div className="space-y-8">
        {/* User Personalization */}
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Customize T3 Chat</h3>
          
          <div className="space-y-5">
            {/* User Name */}
            <div>
              <label className="text-sm font-medium text-black/70 dark:text-white/70 block mb-2">
                What should T3 Chat call you?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customization.userName}
                  onChange={(e) => {
                    if (e.target.value.length <= 50) {
                      setCustomization(prev => ({ ...prev, userName: e.target.value }))
                    }
                  }}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500/50 dark:focus:border-rose-300/50 focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/30"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/50 dark:text-white/50">
                  {customization.userName.length}/50
                </div>
              </div>
            </div>

            {/* User Role */}
            <div>
              <label className="text-sm font-medium text-black/70 dark:text-white/70 block mb-2">
                What do you do?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customization.userRole}
                  onChange={(e) => {
                    if (e.target.value.length <= 100) {
                      setCustomization(prev => ({ ...prev, userRole: e.target.value }))
                    }
                  }}
                  placeholder="Engineer, student, etc."
                  className="w-full px-4 py-3 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500/50 dark:focus:border-rose-300/50 focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/30"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/50 dark:text-white/50">
                  {customization.userRole.length}/100
                </div>
              </div>
            </div>

            {/* Traits */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-black/70 dark:text-white/70">
                  What traits should T3 Chat have? (up to 50, max 100 chars each)
                </label>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {customization.userTraits.length}/50
                </span>
              </div>
              
              <div className="relative mb-2">
                <input
                  type="text"
                  value={traitInput}
                  onChange={(e) => {
                    if (e.target.value.length <= 100) {
                      setTraitInput(e.target.value)
                    }
                  }}
                  onKeyDown={handleTraitKeyDown}
                  placeholder="Type a trait and press Enter or Tab..."
                  className="w-full px-4 py-3 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500/50 dark:focus:border-rose-300/50 focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/30"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/50 dark:text-white/50">
                  {traitInput.length}/100
                </div>
              </div>
              
              {/* Traits list */}
              {customization.userTraits.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {customization.userTraits.map((trait, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-1 bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 dark:border-rose-300/20 rounded-full pl-3 pr-2 py-1"
                    >
                      <span className="text-sm">{trait}</span>
                      <button 
                        onClick={() => handleRemoveTrait(index)}
                        className="w-4 h-4 flex items-center justify-center text-rose-500/70 dark:text-rose-300/70 hover:text-rose-600 dark:hover:text-rose-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-black/70 dark:text-white/70">
                  Anything else T3 Chat should know about you?
                </label>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {customization.userAdditionalInfo.length}/3000
                </span>
              </div>
              <textarea
                value={customization.userAdditionalInfo}
                onChange={(e) => {
                  if (e.target.value.length <= 3000) {
                    setCustomization(prev => ({ ...prev, userAdditionalInfo: e.target.value }))
                  }
                }}
                placeholder="Interests, values, or preferences to keep in mind"
                className="w-full px-4 py-3 h-32 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500/50 dark:focus:border-rose-300/50 focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/30 resize-none"
              />
            </div>
            
            {/* Default Prompt Template */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-black/70 dark:text-white/70">
                  Default Prompt Template
                </label>
              </div>
              <textarea
                value={customization.promptTemplate}
                onChange={(e) => setCustomization(prev => ({ ...prev, promptTemplate: e.target.value }))}
                placeholder="E.g., You are a helpful assistant. Please help me with..."
                className="w-full px-4 py-3 h-20 text-sm rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500/50 dark:focus:border-rose-300/50 focus:outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/30 resize-none"
              />
              <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                This template will be automatically applied to new conversations.
              </p>
            </div>
          </div>
        </div>

        {/* Visual Options */}
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Visual Options</h3>
          
          <div className="space-y-5">

            
            {/* Main Text Font */}
            <div>
              <label className="text-sm font-medium text-black/70 dark:text-white/70 block mb-2">
                Main Text Font
              </label>
              <p className="text-xs text-black/50 dark:text-white/50 mb-2">
                Used in general text throughout the app.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'inter', label: 'Inter', style: 'font-sans' },
                  { value: 'system', label: 'System', style: 'font-sans' },
                  { value: 'serif', label: 'Serif', style: 'font-serif' },
                  { value: 'mono', label: 'Mono', style: 'font-mono' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setCustomization(prev => ({ ...prev, mainFont: option.value as any }))}
                    className={cn(
                      'py-2 px-3 rounded border transition-all text-center',
                      option.style,
                      customization.mainFont === option.value
                        ? 'bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 border-rose-500/20 dark:border-rose-300/20'
                        : 'bg-white/30 dark:bg-[oklch(0.18_0.015_25)]/20 text-black/70 dark:text-white/70 border-rose-100/20 dark:border-rose-500/10 hover:bg-white/50 dark:hover:bg-[oklch(0.18_0.015_25)]/30'
                    )}
                  >
                    <span className="text-sm">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Code Font */}
            <div>
              <label className="text-sm font-medium text-black/70 dark:text-white/70 block mb-2">
                Code Font
              </label>
              <p className="text-xs text-black/50 dark:text-white/50 mb-2">
                Used in code blocks and inline code in chat messages.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'fira-code', label: 'Fira Code', style: 'font-mono' },
                  { value: 'mono', label: 'Mono', style: 'font-mono' },
                  { value: 'consolas', label: 'Consolas', style: 'font-mono' },
                  { value: 'jetbrains', label: 'JetBrains', style: 'font-mono' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setCustomization(prev => ({ ...prev, codeFont: option.value as any }))}
                    className={cn(
                      'py-2 px-3 rounded border transition-all text-center',
                      option.style,
                      customization.codeFont === option.value
                        ? 'bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 border-rose-500/20 dark:border-rose-300/20'
                        : 'bg-white/30 dark:bg-[oklch(0.18_0.015_25)]/20 text-black/70 dark:text-white/70 border-rose-100/20 dark:border-rose-500/10 hover:bg-white/50 dark:hover:bg-[oklch(0.18_0.015_25)]/30'
                    )}
                  >
                    <span className="text-sm">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Fonts Preview */}
            <div>
              <label className="text-sm font-medium text-black/70 dark:text-white/70 block mb-2">
                Fonts Preview
              </label>
              <div className="rounded-lg overflow-hidden border border-rose-200/30 dark:border-rose-500/10">
                <div className="bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 p-4">
                  <div className={cn("text-black dark:text-white mb-2", 
                    customization.mainFont === 'inter' ? 'font-sans' : 
                    customization.mainFont === 'serif' ? 'font-serif' : 
                    customization.mainFont === 'mono' ? 'font-mono' : 'font-sans'
                  )}>
                    <p>Can you write me a simple hello world program?</p>
                  </div>
                  <div className="pl-4 border-l-2 border-rose-500/20 dark:border-rose-300/20">
                    <p className={cn("text-black dark:text-white mb-2", 
                      customization.mainFont === 'inter' ? 'font-sans' : 
                      customization.mainFont === 'serif' ? 'font-serif' : 
                      customization.mainFont === 'mono' ? 'font-mono' : 'font-sans'
                    )}>
                      Sure, here you go:
                    </p>
                    <pre className={cn("bg-black/5 dark:bg-white/5 p-3 rounded text-black/90 dark:text-white/90 overflow-x-auto", 
                      customization.codeFont === 'fira-code' ? 'font-mono' : 
                      customization.codeFont === 'mono' ? 'font-mono' : 
                      customization.codeFont === 'consolas' ? 'font-mono' : 
                      customization.codeFont === 'jetbrains' ? 'font-mono' : 'font-mono'
                    )}>
                      <code>{`function greet(name: string) {\n\tconsole.log(\`Hello, \${name}!\`);\n\treturn true;\n}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Behavior */}
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Behavior</h3>
          
          <div className="space-y-5">
            {/* Send Behavior */}
            <div>
              <label className="text-sm font-medium text-black/70 dark:text-white/70 block mb-2">
                Send Message With
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'enter', label: 'Enter Key', icon: ArrowUp },
                  { value: 'shiftEnter', label: 'Shift+Enter', icon: ArrowUp },
                  { value: 'button', label: 'Button Only', icon: SendHorizonal }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setCustomization(prev => ({ ...prev, sendBehavior: option.value as any }))}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 px-3 rounded border transition-all',
                      customization.sendBehavior === option.value
                        ? 'bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 border-rose-500/20 dark:border-rose-300/20'
                        : 'bg-white/30 dark:bg-[oklch(0.18_0.015_25)]/20 text-black/70 dark:text-white/70 border-rose-100/20 dark:border-rose-500/10 hover:bg-white/50 dark:hover:bg-[oklch(0.18_0.015_25)]/30'
                    )}
                  >
                    <option.icon className="w-4 h-4" />
                    <span className="text-sm">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>



            {/* Chat Settings */}
            <div className="space-y-3">
              {[
                { key: 'autoSave', label: 'Auto-save conversations', icon: Download },
                { key: 'showTimestamps', label: 'Show message timestamps', icon: Clock },
                { key: 'showModelInfo', label: 'Show model info in messages', icon: Brain }
              ].map((setting) => (
                <div key={setting.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <setting.icon className="w-4 h-4 text-black/60 dark:text-white/60" />
                    <span className="text-sm text-black dark:text-white">{setting.label}</span>
                  </div>
                  <button
                    onClick={() => setCustomization(prev => ({ ...prev, [setting.key]: !prev[setting.key as keyof typeof prev] }))}
                    className={cn(
                      'w-9 h-5 rounded-full transition-colors relative',
                      customization[setting.key as keyof typeof customization]
                        ? 'bg-rose-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full bg-white shadow-sm transition-transform absolute top-0.5',
                      customization[setting.key as keyof typeof customization]
                        ? 'translate-x-4'
                        : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              ))}
            </div>


          </div>
        </div>



        {/* Reset Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setCustomization({
              // User Personalization
              userName: '',
              userRole: '',
              userTraits: [],
              userAdditionalInfo: '',
              promptTemplate: '',
              
              // Visual Options
              mainFont: 'inter',
              codeFont: 'fira-code',
              
              // Behavior
              sendBehavior: 'enter',
              autoSave: true,
              showTimestamps: true
            })}
            className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    )
  }

  const renderDataSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Data Management</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 hover:bg-white/50 dark:hover:bg-[oklch(0.22_0.015_25)]/40 transition-colors">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-black/60 dark:text-white/60" />
              <span className="text-black dark:text-white">Export my data</span>
            </div>
            <ChevronRight className="w-4 h-4 text-black/40 dark:text-white/40" />
          </button>

          <button className="w-full flex items-center justify-between p-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 hover:bg-white/50 dark:hover:bg-[oklch(0.22_0.015_25)]/40 transition-colors">
            <div className="flex items-center gap-3">
              <Copy className="w-5 h-5 text-black/60 dark:text-white/60" />
              <span className="text-black dark:text-white">Backup conversations</span>
            </div>
            <ChevronRight className="w-4 h-4 text-black/40 dark:text-white/40" />
          </button>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-red-500/5 dark:bg-red-300/5 border border-red-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h4 className="font-medium text-red-600 dark:text-red-400">Danger Zone</h4>
        </div>
        <p className="text-sm text-black/60 dark:text-white/60 mb-3">
          Permanently delete all your conversations and data
        </p>
        <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm">
          Delete All Data
        </button>
      </div>
    </div>
  )

  const renderAccountSection = () => (
    <div className="space-y-8">
      {/* Profile Information */}
      <div>
        <h3 className="text-lg font-semibold text-black dark:text-white mb-6">Profile Information</h3>
        
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {userProfile.name.charAt(0).toUpperCase()}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2">
              <span className={cn(
                'px-2 py-1 text-xs rounded-full',
                userProfile.plan === 'pro' 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white' 
                  : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300'
              )}>
                {userProfile.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
              Display Name
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={tempProfile.name}
                onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500 dark:focus:border-rose-300 focus:outline-none text-black dark:text-white"
              />
            ) : (
              <div className="w-full px-4 py-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 border border-rose-200/30 dark:border-rose-500/10 text-black dark:text-white">
                {userProfile.name}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
              Email Address
            </label>
            {isEditingProfile ? (
              <input
                type="email"
                value={tempProfile.email}
                onChange={(e) => setTempProfile({ ...tempProfile, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 border border-rose-200/50 dark:border-rose-500/20 focus:border-rose-500 dark:focus:border-rose-300 focus:outline-none text-black dark:text-white"
              />
            ) : (
              <div className="w-full px-4 py-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 border border-rose-200/30 dark:border-rose-500/10 text-black dark:text-white">
                {userProfile.email}
              </div>
            )}
          </div>

          {isEditingProfile ? (
            <div className="flex gap-2">
              <button
                onClick={handleProfileSave}
                className="flex-1 py-2 px-4 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={handleProfileCancel}
                className="flex-1 py-2 px-4 bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 text-black dark:text-white rounded-lg hover:bg-white/50 dark:hover:bg-[oklch(0.22_0.015_25)]/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="w-full py-2 px-4 bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 rounded-lg hover:bg-rose-500/20 dark:hover:bg-rose-300/20 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Account Management */}
      <div>
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Account Management</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 hover:bg-white/50 dark:hover:bg-[oklch(0.22_0.015_25)]/40 transition-colors">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-black/60 dark:text-white/60" />
              <span className="text-black dark:text-white">Change password</span>
            </div>
            <ChevronRight className="w-4 h-4 text-black/40 dark:text-white/40" />
          </button>

          <button className="w-full flex items-center justify-between p-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 hover:bg-white/50 dark:hover:bg-[oklch(0.22_0.015_25)]/40 transition-colors">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-black/60 dark:text-white/60" />
              <span className="text-black dark:text-white">Update email preferences</span>
            </div>
            <ChevronRight className="w-4 h-4 text-black/40 dark:text-white/40" />
          </button>

          <button className="w-full flex items-center justify-between p-3 rounded-lg bg-white/30 dark:bg-[oklch(0.22_0.015_25)]/20 hover:bg-white/50 dark:hover:bg-[oklch(0.22_0.015_25)]/40 transition-colors">
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-black/60 dark:text-white/60" />
              <span className="text-black dark:text-white">Sign out</span>
            </div>
            <ChevronRight className="w-4 h-4 text-black/40 dark:text-white/40" />
          </button>
        </div>
      </div>

      {/* Upgrade Section */}
      {userProfile.plan === 'free' && (
        <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500"></div>
            <h4 className="font-medium text-amber-600 dark:text-amber-400">Upgrade to Pro</h4>
          </div>
          <p className="text-sm text-black/60 dark:text-white/60 mb-3">
            Get unlimited conversations, advanced features, and priority support
          </p>
          <button className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors text-sm">
            Upgrade Now
          </button>
        </div>
      )}
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
        return renderAccountSection()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Settings Panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full max-w-4xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border-l border-rose-500/10 dark:border-white/10 z-50 shadow-2xl flex"
          >
            {/* Gradient overlays for premium look */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none"></div>

            {/* Sidebar */}
            <div className="w-80 border-r border-rose-500/10 dark:border-white/10 p-6 relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 dark:from-rose-300 dark:via-rose-200 dark:to-rose-300 bg-clip-text text-transparent">
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 text-black/50 dark:text-white/50 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded-lg transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left',
                      activeSection === section.id
                        ? 'bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 shadow-lg'
                        : 'text-black/70 dark:text-white/70 hover:bg-rose-500/5 dark:hover:bg-white/5 hover:text-rose-600 dark:hover:text-rose-300'
                    )}
                  >
                    <section.icon className="w-5 h-5" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto relative z-10">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </div>

            {/* Premium glow effect in dark mode */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 