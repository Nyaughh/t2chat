'use client'

import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { UserMetadata } from '@/lib/types'
import { memo, useMemo, useCallback } from 'react'

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

const SignedInProfile = memo(
  ({ userMetadata, onSettingsClick }: { userMetadata: UserMetadata; onSettingsClick: () => void }) => {
    const handleClick = useCallback(() => {
      onSettingsClick()
    }, [onSettingsClick])

    return (
      <div
        onClick={handleClick}
        className="flex items-center gap-2 p-2 rounded-xl border border-rose-500/20 dark:border-rose-300/20 bg-gradient-to-r from-rose-500/8 via-background/90 to-rose-500/8 dark:from-rose-300/8 dark:via-background/90 dark:to-rose-300/8 backdrop-blur-sm cursor-pointer hover:from-rose-500/12 hover:via-background/95 hover:to-rose-500/12 dark:hover:from-rose-300/12 dark:hover:via-background/95 dark:hover:to-rose-300/12 hover:border-rose-500/30 dark:hover:border-rose-300/30 hover:shadow-lg hover:shadow-rose-500/10 dark:hover:shadow-rose-300/10 transition-all duration-200 ease-[0.25,1,0.5,1] group"
      >
        <div className="relative">
          <ProfileAvatar userMetadata={userMetadata} />
        </div>
        <div className="flex flex-col overflow-hidden">
          <div className="text-sm font-semibold truncate text-foreground/90 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors duration-200">
            {userMetadata.name || userMetadata.email}
          </div>
          <div className="text-[10px] text-muted-foreground/50 truncate">Free</div>
        </div>
      </div>
    )
  },
)

SignedInProfile.displayName = 'SignedInProfile'

const SignInButton = memo(() => (
  <Link href="/auth">
    <Button
      variant="ghost"
      className="group w-full justify-start h-auto px-2.5 py-1.5 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/5 hover:from-rose-500/10 hover:to-rose-500/10 dark:hover:from-rose-300/10 dark:hover:to-rose-300/10 border border-rose-500/10 dark:border-rose-300/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-200 ease-[0.25,1,0.5,1] rounded-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key="sign-in"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="flex items-center gap-3 w-full"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 rounded-full bg-rose-500/30 dark:bg-rose-300/30"></div>
            </div>
            <div className="flex-1 text-center min-w-0">
              <div className="text-sm font-medium text-black/80 dark:text-white/80 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors duration-150 ease-[0.25,1,0.5,1]">
                Sign in
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="w-4 h-4 text-black/40 dark:text-white/40 group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors duration-150 ease-[0.25,1,0.5,1] flex-shrink-0">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Button>
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
