'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { UserMetadata } from '@/lib/types'
import React, { memo, useMemo, useCallback, useState } from 'react'
import { Settings, LogOut, Github, MessageCircle, ChevronDown, ChevronRight, LogIn } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

interface UserProfileProps {
  isSignedIn: boolean
  userMetadata: UserMetadata
  onSettingsClick: () => void
}

// Memoized components to prevent unnecessary rerenders
const ProfileAvatar = memo(({ userMetadata }: { userMetadata: UserMetadata }) => {
  const avatarContent = useMemo(() => {
    if (userMetadata.image) {
      return (
        <img src={userMetadata.image} alt="User profile" className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
      )
    }

    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
        <div className="text-rose-600 dark:text-rose-300 font-medium text-sm">
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
      className="surface-popover absolute bottom-full left-0 right-0 mb-2 rounded-xl p-1.5 z-50"
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
  ({ userMetadata, onSettingsClick }: { userMetadata: UserMetadata; onSettingsClick: () => void }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const router = useRouter()

    const handleToggleDropdown = useCallback((e: React.MouseEvent) => {
      e.stopPropagation()
      setIsDropdownOpen(!isDropdownOpen)
    }, [isDropdownOpen])

    const handleSettingsClick = useCallback(() => {
      setIsDropdownOpen(false)
      onSettingsClick()
    }, [onSettingsClick])

    const handleSignOut = useCallback(async () => {
      setIsDropdownOpen(false)
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.refresh()
          },
        },
      })
    }, [router])

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
          type="button"
          onClick={handleToggleDropdown}
          aria-expanded={isDropdownOpen}
          className="group flex w-full items-center gap-2.5 rounded-xl border border-rose-500/15 bg-gradient-to-r from-rose-500/8 via-background/90 to-rose-500/8 p-2 text-left cursor-pointer backdrop-blur-sm transition-all duration-200 ease-[0.25,1,0.5,1] hover:border-rose-500/30 hover:shadow-md hover:shadow-rose-500/10 dark:border-rose-300/15 dark:from-rose-300/8 dark:to-rose-300/8 dark:hover:border-rose-300/30 dark:hover:shadow-black/20"
        >
          <div className="relative">
            <ProfileAvatar userMetadata={userMetadata} />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="text-sm font-semibold truncate text-foreground/90 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors duration-200">
              {userMetadata.name || userMetadata.email}
            </div>
            <div className="text-xs text-muted-foreground truncate">Free</div>
          </div>
          <ChevronDown 
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
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
    className="group flex w-full items-center gap-2.5 rounded-xl border border-rose-500/15 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 p-2 backdrop-blur-sm transition-all duration-200 ease-[0.25,1,0.5,1] hover:border-rose-500/30 hover:from-rose-500/10 hover:to-rose-500/10 dark:border-rose-300/15 dark:from-rose-300/5 dark:to-rose-300/5 dark:hover:border-rose-300/30 dark:hover:from-rose-300/10 dark:hover:to-rose-300/10"
  >
    <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 text-rose-600 dark:from-rose-300/20 dark:to-rose-400/20 dark:text-rose-300">
      <LogIn className="size-4" />
    </div>
    <span className="flex-1 text-sm font-semibold text-foreground/90 transition-colors duration-150 group-hover:text-rose-600 dark:group-hover:text-rose-300">
      Sign in
    </span>
    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-rose-600 dark:group-hover:text-rose-300" />
  </Link>
))

SignInButton.displayName = 'SignInButton'

export const UserProfile = memo(function UserProfile({ isSignedIn, userMetadata, onSettingsClick }: UserProfileProps) {
  return (
    <div className="p-4 flex-shrink-0">
      <AnimatePresence mode="wait">
        {isSignedIn ? (
          <motion.div
            key="signed-in"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <SignedInProfile userMetadata={userMetadata} onSettingsClick={onSettingsClick} />
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
