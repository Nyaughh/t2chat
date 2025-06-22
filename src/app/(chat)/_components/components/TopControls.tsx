'use client'

import { Settings, Menu, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import { useRouter } from 'next/navigation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TopControlsProps {
  isSignedIn: boolean
  effectiveSidebarOpen: boolean
  isOnHomePage: boolean
  onToggleSidebar: () => void
  onSettingsClick: () => void
  onNewChat: () => void
}

export function TopControls({
  isSignedIn,
  effectiveSidebarOpen,
  isOnHomePage,
  onToggleSidebar,
  onSettingsClick,
  onNewChat,
}: TopControlsProps) {
  const router = useRouter()

  const handleSettingsClick = () => {
    if (isSignedIn) {
      onSettingsClick()
    } else {
      router.push('/auth')
    }
  }

  // Shared styles for consistent button groups
  const buttonGroupStyles =
    'group relative p-2 rounded-lg bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20 hover:shadow-xl hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10 flex items-center gap-1.5'

  const buttonStyles =
    'relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5.5 w-5.5 p-0 hover:bg-transparent flex items-center justify-center'

  const dividerStyles = 'relative z-10 w-px h-4.5 bg-rose-500/20 dark:bg-rose-300/20'

  return (
    <>
      {/* Settings & Theme Switcher - Always visible */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <div className={buttonGroupStyles}>
          {/* Gradient overlays for premium look */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-lg"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-lg"></div>

          <ThemeSwitcher />

          {/* Vertical divider */}
          <div className={dividerStyles}></div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleSettingsClick} className={cn(buttonStyles, 'hover:cursor-pointer')}>
                <Settings className="w-4.5 h-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{isSignedIn ? 'Settings' : 'Sign in to access settings'}</TooltipContent>
          </Tooltip>

          {/* Premium glow effect in dark mode */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-lg blur-xl opacity-0 dark:opacity-20 pointer-events-none"></div>
        </div>
      </div>

      {/* Menu and New Chat buttons for mobile/collapsed sidebar */}
      <div className={cn('absolute top-2.5 left-2.5 z-30', effectiveSidebarOpen ? 'md:opacity-0' : 'opacity-100')}>
        <div className={buttonGroupStyles}>
          {/* Gradient overlays for premium look */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-lg"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-lg"></div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onToggleSidebar} className={cn(buttonStyles, 'hover:cursor-pointer')}>
                <Menu className="w-4.5 h-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
          </Tooltip>

          {/* Vertical divider */}
          <div className={dividerStyles}></div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNewChat}
                className={cn(buttonStyles,
                  isOnHomePage 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'hover:cursor-pointer'
                  )}
                disabled={isOnHomePage}
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{isOnHomePage ? 'Already on home page' : 'New conversation'}</TooltipContent>
          </Tooltip>

          {/* Premium glow effect in dark mode */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-lg blur-xl opacity-0 dark:opacity-20 pointer-events-none"></div>
        </div>
      </div>
    </>
  )
}
