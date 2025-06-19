'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useConversations } from '@/hooks/useConversations'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Conversation, db } from '@/lib/dexie'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AccountSettings,
  CustomizeSettings,
  DataSettings,
  ModelsKeysSettings,
  SettingsSidebar,
} from '@/components/settings'
import { cn } from '@/lib/utils'
import { Settings, X, LogOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SpeechSettings from '@/components/settings/SpeechSettings'
import { settingsSections, type SettingsSection } from '@/components/settings/config'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { userMetadata, isPending, isSignedIn } = useAuth()

  const { unmigratedLocalChats } = useConversations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()

  const memoizedUser = useMemo(
    () => ({
      name: userMetadata.name || '',
      email: userMetadata.email || '',
      image: userMetadata.image || '',
    }),
    [userMetadata],
  )

  const [activeSection, setActiveSection] = useState<SettingsSection>('account')
  const userSettings = useQuery(api.users.getMySettings)
  const apiKeys = useQuery(api.api_keys.getApiKeys)

  // Update active section based on URL query params
  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsSection
    if (tab && settingsSections.some((section) => section.id === tab)) {
      setActiveSection(tab)
    }
  }, [searchParams])

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', section)
    router.replace(url.pathname + url.search)
  }

  const handleClose = () => {
    router.back()
  }

  if (!isPending && !isSignedIn) {
    router.push('/')
  }

  if (isPending) {
    return <div className="flex-1 flex items-center justify-center"> <Loader2 className="w-5 h-5 animate-spin" /> </div>
  }

  const clearAllLocalData = async () => {
    try {
      // First try to clear Dexie databases
      try {
        await db.conversations.clear()
        await db.messages.clear()
      } catch (dexieError) {
        console.warn('Failed to clear Dexie databases:', dexieError)
      }

      // Clear all IndexedDB databases completely
      try {
        if ('indexedDB' in window) {
          // Get all database names
          const databases = await indexedDB.databases()

          // Delete each database
          for (const dbInfo of databases) {
            if (dbInfo.name) {
              console.log(`Deleting IndexedDB database: ${dbInfo.name}`)
              await new Promise((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(dbInfo.name!)
                deleteReq.onsuccess = () => {
                  console.log(`Successfully deleted database: ${dbInfo.name}`)
                  resolve(undefined)
                }
                deleteReq.onerror = () => {
                  console.warn(`Failed to delete database: ${dbInfo.name}`)
                  resolve(undefined) // Don't reject, just continue
                }
                deleteReq.onblocked = () => {
                  console.warn(`Database deletion blocked: ${dbInfo.name}`)
                  resolve(undefined) // Don't reject, just continue
                }
              })
            }
          }
        }
      } catch (indexedDbError) {
        console.warn('Failed to clear IndexedDB:', indexedDbError)
      }

      // Clear all localStorage
      try {
        // Clear specific known keys first
        const localStorageKeys = [
          'lastUsedModelId', // Last selected model
          't2chat-sidebar-open', // Sidebar state
          'mainFont', // Font preferences
          'codeFont', // Code font preferences
          'selectedVoiceURI', // Speech synthesis voice
          'thinkingEnabled', // AI thinking mode
          'webSearchEnabled', // Web search toggle
          'groupBy', // Model grouping preference
        ]

        localStorageKeys.forEach((key) => {
          localStorage.removeItem(key)
        })

        // Clear any other t2chat related localStorage items
        const allKeys = Object.keys(localStorage)
        allKeys.forEach((key) => {
          if (key.startsWith('t2chat-') || key.startsWith('t2Chat')) {
            localStorage.removeItem(key)
          }
        })

        console.log('Cleared localStorage')
      } catch (localStorageError) {
        console.warn('Failed to clear localStorage:', localStorageError)
      }

      // Clear sessionStorage as well
      try {
        const sessionKeys = Object.keys(sessionStorage)
        sessionKeys.forEach((key) => {
          if (key.startsWith('t2chat-') || key.startsWith('t2Chat')) {
            sessionStorage.removeItem(key)
          }
        })
        console.log('Cleared sessionStorage')
      } catch (sessionStorageError) {
        console.warn('Failed to clear sessionStorage:', sessionStorageError)
      }

      console.log('All local data cleared successfully')
      toast.success('Local data cleared successfully')
    } catch (error) {
      console.error('Error clearing local data:', error)
      toast.error('Failed to clear local data')
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          // Clear all local data when user logs out
          console.log('Clearing all local data')
          await clearAllLocalData()
          router.refresh()
        },
      },
    })
  }

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
          setActiveSection={handleSectionChange}
          isMobile={isMobile}
        />
        <main className={cn('flex-1 overflow-y-auto bg-background', isMobile ? 'p-4' : 'p-6')}>
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
