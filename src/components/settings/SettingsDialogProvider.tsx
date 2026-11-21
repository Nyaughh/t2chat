'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserMetadata } from '@/lib/types'
import { SettingsDialog } from './SettingsDialog'
import { DEFAULT_SETTINGS_SECTION, type SettingsSection } from './config'

type OpenSettings = (
  section?: SettingsSection,
  options?: {
    /**
     * Element to focus when the dialog closes. Defaults to whatever had focus when it opened;
     * pass a stable element when the trigger itself unmounts (e.g. an item in a closing menu).
     */
    returnFocusTo?: HTMLElement | null
  },
) => void

interface SettingsDialogContextValue {
  isOpen: boolean
  openSettings: OpenSettings
  closeSettings: () => void
}

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null)

/**
 * Owns the settings dialog for the chat shell. Mounted once in ChatLayout, so the dialog
 * opens over whichever chat is showing and survives client-side navigation.
 */
export function SettingsDialogProvider({
  isSignedIn,
  userMetadata,
  children,
}: {
  isSignedIn: boolean
  userMetadata: UserMetadata
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>(DEFAULT_SETTINGS_SECTION)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const openSettings = useCallback<OpenSettings>((nextSection, options) => {
    const active = typeof document !== 'undefined' ? document.activeElement : null
    returnFocusRef.current = options?.returnFocusTo ?? (active instanceof HTMLElement ? active : null)
    setSection(nextSection ?? DEFAULT_SETTINGS_SECTION)
    setIsOpen(true)
  }, [])

  const closeSettings = useCallback(() => setIsOpen(false), [])

  const handleCloseAutoFocus = useCallback((event: Event) => {
    const target = returnFocusRef.current
    returnFocusRef.current = null
    // Radix would refocus the element that had focus on open; that fails when it has since
    // unmounted, so fall back to the explicit return target.
    if (target && target.isConnected) {
      event.preventDefault()
      target.focus({ preventScroll: true })
    }
  }, [])

  const value = useMemo(
    () => ({ isOpen: isOpen && isSignedIn, openSettings, closeSettings }),
    [isOpen, isSignedIn, openSettings, closeSettings],
  )

  return (
    <SettingsDialogContext.Provider value={value}>
      {children}
      {isSignedIn && (
        <SettingsDialog
          open={isOpen}
          onOpenChange={setIsOpen}
          section={section}
          onSectionChange={setSection}
          userMetadata={userMetadata}
          onCloseAutoFocus={handleCloseAutoFocus}
        />
      )}
    </SettingsDialogContext.Provider>
  )
}

/**
 * Open settings from anywhere in the chat shell. Outside the provider (shouldn't happen in
 * the app) it falls back to the /settings URL, which opens the dialog after navigation.
 */
export function useSettingsDialog(): SettingsDialogContextValue {
  const context = useContext(SettingsDialogContext)
  const router = useRouter()

  const fallback = useMemo<SettingsDialogContextValue>(
    () => ({
      isOpen: false,
      openSettings: (section) => router.push(section ? `/settings?tab=${section}` : '/settings'),
      closeSettings: () => {},
    }),
    [router],
  )

  return context ?? fallback
}
