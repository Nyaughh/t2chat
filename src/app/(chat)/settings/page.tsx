'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useConversations } from '@/hooks/useConversations'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Conversation } from '@/lib/dexie'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AccountSettings,
  CustomizeSettings,
  DataSettings,
  ModelsKeysSettings,
  SettingsSidebar,
} from '@/components/settings'
import { AttachmentsSettings } from '@/components/settings/attachments'
import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SettingsSection = 'account' | 'models' | 'customize' | 'data' | 'attachments'

export default function SettingsPage() {
  const { userMetadata } = useAuth()
  const { unmigratedLocalChats } = useConversations()
  const router = useRouter()
  const isMobile = useIsMobile()

  const [activeSection, setActiveSection] = useState<SettingsSection>('account')
  const userSettings = useQuery(api.users.getUserSettings)
  const apiKeys = useQuery(api.api_keys.getApiKeys)
  const updateUserSettings = useMutation(api.users.updateUserSettings)

  const handleClose = () => {
    router.back()
  }

  const updateSettings = (updates: Partial<any>) => {
    const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        acc[key] = value
      }
      return acc
    }, {} as Partial<any>)

    if (Object.keys(filteredUpdates).length > 0) {
      updateUserSettings(filteredUpdates)
    }
  }

  const memoizedUser = useMemo(
    () => ({
      name: userMetadata.name || '',
      email: userMetadata.email || '',
      image: userMetadata.image || '',
    }),
    [userMetadata],
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings user={memoizedUser} />
      case 'models':
        return <ModelsKeysSettings apiKeys={apiKeys || []} userSettings={userSettings} onSettingsChange={updateSettings} />
      case 'customize':
        return (
          <CustomizeSettings
            customization={{
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
            }}
            onSettingsChange={updateSettings}
          />
        )
      case 'data':
        return <DataSettings unmigratedLocalChats={unmigratedLocalChats as Conversation[]} />
      case 'attachments':
        return <AttachmentsSettings />
      default:
        return null
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900">
      <header className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h2 className="text-lg font-bold text-black/80 dark:text-white/80">Settings</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-black/50 dark:text-white/50">
          <X className="w-5 h-5" />
        </Button>
      </header>
      <div className={cn('flex flex-1 min-h-0', isMobile && 'flex-col')}>
        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isMobile={isMobile}
        />
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
    </div>
  )
} 