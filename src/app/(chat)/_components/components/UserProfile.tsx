'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { UserMetadata } from '@/lib/types'
import React, { memo, useMemo, useCallback, useRef, useState } from 'react'
import { Settings, LogOut, Github, MessageCircle, ChevronDown, ChevronRight, LogIn } from 'lucide-react'
import { useSettingsDialog } from '@/components/settings/SettingsDialogProvider'
import { useSignOut } from '@/hooks/useSignOut'
import { ItemHighlight } from '@/components/ui/item-highlight'
import { MASKED_EMAIL, MASKED_NAME, usePrivacyPref } from '@/hooks/usePrivacyPrefs'

interface UserProfileProps {
  isSignedIn: boolean
  userMetadata: UserMetadata
}

// Memoized components to prevent unnecessary rerenders
const ProfileAvatar = memo(({ userMetadata }: { userMetadata: UserMetadata }) => {
  const avatarContent = useMemo(() => {
    if (userMetadata.image) {
      return (
        <img src={userMetadata.image} alt="" className="size-7 rounded-full flex-shrink-0 object-cover" />
      )
    }

    return (
      <div className="size-7 rounded-full bg-rose-500/10 dark:bg-rose-300/10 flex items-center justify-center flex-shrink-0">
        <div className="text-rose-600 dark:text-rose-300 font-medium text-xs uppercase">
          {userMetadata.name?.[0] || userMetadata.email?.[0] || '?'}
        </div>
      </div>
    )
  }, [userMetadata.image, userMetadata.name, userMetadata.email])

  return avatarContent
})

ProfileAvatar.displayName = 'ProfileAvatar'

const ProfileDropdown = memo(({ 
  isOpen, 
  onSettingsClick,
  onSignOut
}: { 
  isOpen: boolean
  onSettingsClick: () => void
  onSignOut: () => void
}) => {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
      className="surface-popover absolute bottom-full left-0 right-0 mb-1.5 rounded-xl p-1 z-50"
    >
      <button onClick={onSettingsClick} className="menu-item">
        <Settings />
        <span>Settings</span>
      </button>

      <Link href="https://github.com/nyaughh/t2chat" target="_blank" rel="noopener noreferrer" className="menu-item">
        <Github />
        <span>GitHub</span>
      </Link>

      <Link href="https://discord.gg/7VEznftRPZ" target="_blank" rel="noopener noreferrer" className="menu-item">
        <MessageCircle />
        <span>Discord</span>
      </Link>

      <div className="-mx-1 my-1.5 h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent dark:via-rose-300/20" />

      <button onClick={onSignOut} className="menu-item menu-item-destructive">
        <LogOut />
        <span>Sign Out</span>
      </button>
    </motion.div>
  )
})

ProfileDropdown.displayName = 'ProfileDropdown'

const SignedInProfile = memo(
  ({ userMetadata }: { userMetadata: UserMetadata }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const { openSettings } = useSettingsDialog()
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [showName] = usePrivacyPref('showName')
    const [showEmail] = usePrivacyPref('showEmail')
    const displayName = userMetadata.name ? (showName ? userMetadata.name : MASKED_NAME) : null
    const displayEmail = userMetadata.email ? (showEmail ? userMetadata.email : MASKED_EMAIL) : null

    const handleToggleDropdown = useCallback((e: React.MouseEvent) => {
      e.stopPropagation()
      setIsDropdownOpen(!isDropdownOpen)
    }, [isDropdownOpen])

    const handleSettingsClick = useCallback(() => {
      setIsDropdownOpen(false)
      // The menu item unmounts with the menu, so return focus to the profile button instead
      openSettings(undefined, { returnFocusTo: triggerRef.current })
    }, [openSettings])

    const { signOut } = useSignOut()
    const handleSignOut = useCallback(async () => {
      setIsDropdownOpen(false)
      await signOut()
    }, [signOut])

    // Close dropdown when clicking outside
    const handleDocumentClick = useCallback((e: MouseEvent) => {
      if (isDropdownOpen) {
        setIsDropdownOpen(false)
      }
    }, [isDropdownOpen])

    React.useEffect(() => {
      if (isDropdownOpen) {
        document.addEventListener('click', handleDocumentClick)
        return () => document.removeEventListener('click', handleDocumentClick)
      }
    }, [isDropdownOpen, handleDocumentClick])

    return (
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggleDropdown}
          aria-expanded={isDropdownOpen}
          aria-haspopup="menu"
          aria-label="Account menu"
          className="group relative flex w-full items-center gap-2.5 overflow-hidden px-2 py-1.5 text-left cursor-pointer"
        >
          <ItemHighlight active={isDropdownOpen} />
          <div className="relative z-10">
            <ProfileAvatar userMetadata={userMetadata} />
          </div>
          <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
            <div className="text-sm truncate text-foreground/90 transition-colors duration-150 group-hover:text-rose-600 dark:group-hover:text-rose-300">
              {displayName ?? displayEmail}
            </div>
            {displayName && displayEmail && (
              <div className="text-xs text-muted-foreground truncate">{displayEmail}</div>
            )}
          </div>
          <ChevronDown 
            className={`relative z-10 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          <ProfileDropdown 
            isOpen={isDropdownOpen}
            onSettingsClick={handleSettingsClick}
            onSignOut={handleSignOut}
          />
        </AnimatePresence>
      </div>
    )
  },
)

SignedInProfile.displayName = 'SignedInProfile'

const SignInButton = memo(() => (
  <Link
    href="/auth"
    className="group relative flex w-full items-center gap-2.5 overflow-hidden px-2 py-1.5"
  >
    <ItemHighlight />
    <div className="relative z-10 flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300">
      <LogIn className="size-4" />
    </div>
    <span className="relative z-10 flex-1 text-sm font-medium text-foreground/90 transition-colors duration-150 group-hover:text-rose-600 dark:group-hover:text-rose-300">
      Sign in
    </span>
    <ChevronRight className="relative z-10 size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-rose-600 dark:group-hover:text-rose-300" />
  </Link>
))

SignInButton.displayName = 'SignInButton'

export const UserProfile = memo(function UserProfile({ isSignedIn, userMetadata }: UserProfileProps) {
  return (
    <div className="px-2 pt-1 pb-2 flex-shrink-0">
      <AnimatePresence mode="wait">
        {isSignedIn ? (
          <motion.div
            key="signed-in"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <SignedInProfile userMetadata={userMetadata} />
          </motion.div>
        ) : (
          <motion.div
            key="sign-in"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <SignInButton />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
