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
  ModelsKeysSettings,
  type ApiKey,
  type CustomizationState,
  type ModelSettingsState,
  SettingsSidebar,
} from './settings'
import { AttachmentsSettings } from './settings/attachments'
import { Conversation } from '@/lib/dexie'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface SettingsPageProps {
  isOpen: boolean
  onClose: () => void
  user: {
    name: string
    email: string
    image: string
  }
  unmigratedLocalChats: Conversation[]
}

export type SettingsSection = 'account' | 'models' | 'customize' | 'data' | 'attachments'

export const settingsSections = [
  { id: 'account', label: 'My Account', icon: User },
  { id: 'models', label: 'Models & Keys', icon: Brain },
  { id: 'customize', label: 'Customization', icon: Sparkles },
  { id: 'data', label: 'Manage Data', icon: Database },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
]

const SettingsPageContents = ({ isOpen, onClose, user, unmigratedLocalChats }: SettingsPageProps) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account')

  const userSettings = useQuery(api.users.getUserSettings)
  const apiKeys = useQuery(api.api_keys.getApiKeys)

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

  // This will be replaced by settings from the DB
  const modelSettings: ModelSettingsState = {}

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings user={user} />
      case 'models':
        return <ModelsKeysSettings apiKeys={apiKeys || []} userSettings={userSettings} />
      case 'customize':
        return <CustomizeSettings customization={customization} />
      case 'data':
        return <DataSettings unmigratedLocalChats={unmigratedLocalChats} />
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
        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isMobile={isMobile}
        />

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

export default React.memo(SettingsPageContents)
