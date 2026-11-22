'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useQuery } from 'convex/react'
import { motion } from 'framer-motion'
import { LogOut, X, Loader2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useConversations } from '@/hooks/useConversations'
import { useIsMobile } from '@/hooks/use-mobile'
import { Conversation } from '@/lib/dexie'
import { useSignOut } from '@/hooks/useSignOut'
import { UserMetadata } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AccountSettings } from './AccountSettings'
import { CustomizeSettings } from './CustomizeSettings'
import { DataSettings } from './DataSettings'
import { ModelsKeysSettings } from './models-keys'
import SpeechSettings from './SpeechSettings'
import { settingsSections, type SettingsSection } from './config'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  userMetadata: UserMetadata
  /** Called by Radix when the dialog closes, before it restores focus. Return focus here. */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Settings as a modal dialog over the current chat: section nav on the left (a scrollable
 * tab strip on narrow screens) and the active pane on the right. Radix provides the focus
 * trap, Esc to close, scroll lock and labelling; the nav is a Radix tablist, so arrow keys
 * move between sections.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
  userMetadata,
  onCloseAutoFocus,
}: SettingsDialogProps) {
  const isMobile = useIsMobile()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-[overlay-in_150ms_ease-out] dark:bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => {
            // Radix sees Escape first (document capture). If focus is inside a widget that
            // handles Escape itself, like the inline API key form, leave the dialog open and
            // let the keydown reach that widget.
            const active = document.activeElement
            if (active instanceof Element && active.closest('[data-settings-escape]')) event.preventDefault()
          }}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-background text-foreground outline-none',
            // Mobile: full-screen sheet
            'inset-0 h-[100dvh] w-full',
            // Desktop: centred dialog
            'md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(640px,calc(100dvh-4rem))] md:w-[min(860px,calc(100vw-4rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:border-border md:shadow-xl md:shadow-black/10 dark:md:shadow-black/40',
            'data-[state=open]:animate-[settings-dialog-in_180ms_cubic-bezier(0.25,1,0.5,1)]',
          )}
        >
          <TabsPrimitive.Root
            value={section}
            onValueChange={(value) => onSectionChange(value as SettingsSection)}
            orientation={isMobile ? 'horizontal' : 'vertical'}
            className="flex min-h-0 flex-1 flex-col md:flex-row"
          >
            <SettingsNav isMobile={isMobile} onClose={() => onOpenChange(false)} />
            <SettingsPanes
              section={section}
              userMetadata={userMetadata}
              isMobile={isMobile}
              onClose={() => onOpenChange(false)}
            />
          </TabsPrimitive.Root>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function SignOutButton({ onSignedOut, className }: { onSignedOut: () => void; className?: string }) {
  const { signOut, isSigningOut } = useSignOut(onSignedOut)

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isSigningOut}
      className={cn(
        'flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-400/10 dark:hover:text-red-400',
        className,
      )}
    >
      {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      <span>Sign out</span>
    </button>
  )
}

function SettingsNav({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const listRef = useRef<HTMLDivElement>(null)

  // On the horizontal (mobile) strip, keep the active section in view, e.g. after a deep link
  useEffect(() => {
    if (!isMobile) return
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
    if (!list || !active) return
    const left = active.offsetLeft - 12
    const right = active.offsetLeft + active.offsetWidth + 12 - list.clientWidth
    if (list.scrollLeft > left) list.scrollLeft = left
    else if (list.scrollLeft < right) list.scrollLeft = right
  })

  return (
    <aside className="flex shrink-0 flex-col border-b border-border/70 md:w-52 md:border-r md:border-b-0 md:bg-sidebar/40 dark:md:bg-sidebar/30">
      <div className="flex h-12 items-center justify-between gap-2 px-4 md:h-auto md:px-4 md:pt-4 md:pb-3">
        <DialogPrimitive.Title className="text-[15px] font-semibold tracking-tight text-foreground">
          Settings
        </DialogPrimitive.Title>
        {isMobile && <CloseButton className="-mr-2" />}
      </div>

      <TabsPrimitive.List
        ref={listRef}
        aria-label="Settings sections"
        className={cn('relative flex gap-0.5', isMobile ? 'scrollbar-hide overflow-x-auto px-3 pb-2' : 'flex-col px-2')}
      >
        {settingsSections.map((item) => (
          <TabsPrimitive.Trigger
            key={item.id}
            value={item.id}
            className={cn(
              'group flex shrink-0 cursor-pointer items-center gap-2.5 rounded-md text-sm whitespace-nowrap text-muted-foreground transition-colors duration-150 outline-none',
              'hover:bg-foreground/[0.04] hover:text-foreground',
              'data-[state=active]:bg-rose-500/[0.08] data-[state=active]:text-rose-600 dark:data-[state=active]:bg-rose-300/[0.08] dark:data-[state=active]:text-rose-300',
              isMobile ? 'h-8 px-3' : 'h-8 w-full px-2.5',
            )}
          >
            <item.icon className="size-4 shrink-0 opacity-80 group-data-[state=active]:opacity-100" />
            <span>{item.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {!isMobile && (
        <div className="mt-auto px-2 pb-3">
          <SignOutButton onSignedOut={onClose} className="w-full" />
        </div>
      )}
    </aside>
  )
}

function CloseButton({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label="Close settings"
      className={cn(
        'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-foreground/5 hover:text-foreground',
        className,
      )}
    >
      <X className="size-4" />
    </DialogPrimitive.Close>
  )
}

function SettingsPanes({
  section,
  userMetadata,
  isMobile,
  onClose,
}: {
  section: SettingsSection
  userMetadata: UserMetadata
  isMobile: boolean
  onClose: () => void
}) {
  // These queries only run while the dialog is open: Radix unmounts the content when closed.
  const userSettings = useQuery(api.users.getMySettings)
  const apiKeys = useQuery(api.api_keys.getApiKeys)
  const { unmigratedLocalChats } = useConversations()

  const user = useMemo(
    () => ({
      name: userMetadata.name || '',
      email: userMetadata.email || '',
      image: userMetadata.image || '',
    }),
    [userMetadata],
  )

  const customization = useMemo(
    () => ({
      userName: userSettings?.userName ?? '',
      userRole: userSettings?.userRole ?? '',
      userTraits: userSettings?.userTraits ?? [],
      userAdditionalInfo: userSettings?.userAdditionalInfo ?? '',
      promptTemplate: userSettings?.promptTemplate ?? '',
      mainFont: userSettings?.mainFont ?? 'inter',
      codeFont: userSettings?.codeFont ?? 'fira-code',
      sendBehavior: userSettings?.sendBehavior ?? 'enter',
      showTimestamps: userSettings?.showTimestamps ?? true,
    }),
    [userSettings],
  )

  const activeLabel = settingsSections.find((item) => item.id === section)?.label

  const renderContent = () => {
    switch (section) {
      case 'account':
        return (
          <>
            <AccountSettings user={user} />
            {/* The desktop nav has Sign out in its footer; the mobile tab strip has no room */}
            {isMobile && <SignOutButton onSignedOut={onClose} className="mt-6 -ml-2.5" />}
          </>
        )
      case 'models':
        return <ModelsKeysSettings view="models" apiKeys={apiKeys || []} userSettings={userSettings} />
      case 'keys':
        return <ModelsKeysSettings view="keys" apiKeys={apiKeys || []} userSettings={userSettings} />
      case 'customize':
        return <CustomizeSettings customization={customization} />
      case 'data':
        return <DataSettings unmigratedLocalChats={unmigratedLocalChats as Conversation[]} />
      case 'speech':
        return <SpeechSettings />
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="hidden h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 pr-2 pl-6 md:flex">
        <h2 className="text-sm font-medium text-foreground">{activeLabel}</h2>
        <CloseButton />
      </div>
      <TabsPrimitive.Content
        value={section}
        // The pane scrolls; it is reachable with Tab, so give keyboard users a visible focus ring
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-rose-500/20 focus-visible:ring-inset"
      >
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
          className="mx-auto w-full max-w-2xl px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-6 md:py-6"
        >
          {renderContent()}
        </motion.div>
      </TabsPrimitive.Content>
    </div>
  )
}
