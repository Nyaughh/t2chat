'use client'

import { useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { Settings, X, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SpeechSettings from '@/components/settings/SpeechSettings'
import { settingsSections, type SettingsSection } from '@/components/settings/config'
import { authClient } from '@/lib/auth-client'

export default function SettingsPage() {
  const { userMetadata } = useAuth()
  const { unmigratedLocalChats } = useConversations()
  const router = useRouter()
  const isMobile = useIsMobile()

  const [activeSection, setActiveSection] = useState<SettingsSection>('account')
  const userSettings = useQuery(api.users.getMySettings)
  const apiKeys = useQuery(api.api_keys.getApiKeys)

  const handleClose = () => {
    router.back()
  }

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/')
        },
      },
    })
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
        return <ModelsKeysSettings apiKeys={apiKeys || []} userSettings={userSettings} />
      case 'customize':
        return (
          <CustomizeSettings
            customization={{
              userName: userSettings?.userName ?? '',
              userRole: userSettings?.userRole ?? '',
              userTraits: userSettings?.userTraits ?? [],
              userAdditionalInfo: userSettings?.userAdditionalInfo ?? '',
              promptTemplate: userSettings?.promptTemplate ?? '',
              mainFont: userSettings?.mainFont ?? 'inter',
              codeFont: userSettings?.codeFont ?? 'fira-code',
              sendBehavior: userSettings?.sendBehavior ?? 'enter',
              autoSave: userSettings?.autoSave ?? true,
              showTimestamps: userSettings?.showTimestamps ?? true,
            }}
          />
        )
      case 'data':
        return <DataSettings unmigratedLocalChats={unmigratedLocalChats as Conversation[]} />
      case 'speech':
        return <SpeechSettings />
      default:
        return null
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Settings className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <div className="absolute inset-0 bg-rose-500/20 blur-sm rounded-full scale-150" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Settings</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSignOut} 
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose} 
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>
      <div className={cn('flex flex-1 min-h-0', isMobile && 'flex-col')}>
        <SettingsSidebar
          settingsSections={settingsSections}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isMobile={isMobile}
        />
        <main className={cn(
          "flex-1 overflow-y-auto bg-background",
          isMobile ? "p-4" : "p-6"
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="max-w-4xl mx-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
} 