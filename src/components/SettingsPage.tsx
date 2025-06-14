import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { X, User, Database, Brain, Sparkles, Settings, Paperclip } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  AccountSettings,
  CustomizeSettings,
  DataSettings,
  ModelsSettings,
  type ApiKey,
  type CustomizationState,
  type ModelSettingsState,
} from './settings'
import { AttachmentsSettings } from './settings/attachments'

interface SettingsPageProps {
  isOpen: boolean
  onClose: () => void
  user: {
    name: string
    email: string
    image: string
  }
}

type SettingsSection = 'account' | 'models' | 'customize' | 'data' | 'attachments'

// This should be exported from AccountSettings.tsx and re-exported from index.tsx

export default function SettingsPage({ isOpen, onClose, user }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account')

  const customization: CustomizationState = {
    userName: '',
    userRole: '',
    userTraits: [],
    userAdditionalInfo: '',
    promptTemplate: '',

    mainFont: 'inter',
    codeFont: 'fira-code',

    sendBehavior: 'enter',
    autoSave: true,
    showTimestamps: true,
  }

  const modelSettings: ModelSettingsState = {
    'gemini-2.0-flash': { enabled: true },
    'gemini-2.0-flash-lite': { enabled: true },
    'gemini-2.5-flash': { enabled: true },
    'gemini-2.5-pro': { enabled: false },
    'openrouter/google/gemini-flash-1.5': { enabled: true },
    'openrouter/anthropic/claude-3.5-sonnet': { enabled: true },
    'openrouter/mistralai/mistral-large': { enabled: true },
    'openrouter/openai/gpt-4o': { enabled: true },
  }

  const apiKeys: ApiKey[] = [
    { id: '1', name: 'My Gemini Key', provider: 'gemini', key: 'gmn_xxxxxxxxxxxxxx' },
    { id: '2', name: 'Personal OpenRouter', provider: 'openrouter', key: 'or_xxxxxxxxxxxxxx' },
  ]

  const settingsSections = [
    { id: 'account', label: 'My Account', icon: User },
    { id: 'models', label: 'Models & Keys', icon: Brain },
    { id: 'customize', label: 'Customization', icon: Sparkles },
    { id: 'data', label: 'Manage Data', icon: Database },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings user={user} />
      case 'models':
        return <ModelsSettings apiKeys={apiKeys} modelSettings={modelSettings} />
      case 'customize':
        return <CustomizeSettings customization={customization} />
      case 'data':
        return <DataSettings />
      case 'attachments':
        return <AttachmentsSettings />
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

      <div className={cn('flex flex-1 min-h-0', isMobile && 'flex-col')}>
        {/* Sidebar for Desktop, Tabs for Mobile */}
        <aside
          className={cn(
            'flex-shrink-0',
            isMobile
              ? 'p-2 border-b border-black/10 dark:border-white/10'
              : 'w-56 p-4 border-r border-black/10 dark:border-white/10',
          )}
        >
          <nav
            className={cn(
              'flex',
              isMobile ? 'flex-row space-x-1 overflow-x-auto scrollbar-hide' : 'flex-col space-y-1',
            )}
          >
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as SettingsSection)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors',
                  activeSection === section.id
                    ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300 font-semibold'
                    : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5',
                  isMobile ? 'justify-center' : 'w-full text-left',
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
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              when: 'beforeChildren',
            }}
            className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border-l border-rose-500/10 dark:border-white/10 z-50 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="flex flex-col w-full h-full"
            >
              <SettingsPanelContent />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
