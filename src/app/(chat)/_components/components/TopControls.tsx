'use client'

import { Settings, Menu, Plus, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import { useRouter } from 'next/navigation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettingsDialog } from '@/components/settings/SettingsDialogProvider'

interface TopControlsProps {
  isSignedIn: boolean
  effectiveSidebarOpen: boolean
  isOnHomePage: boolean
  onToggleSidebar: () => void
  onNewChat: () => void
}

export function TopControls({
  isSignedIn,
  effectiveSidebarOpen,
  isOnHomePage,
  onToggleSidebar,
  onNewChat,
}: TopControlsProps) {
  const router = useRouter()
  const { openSettings } = useSettingsDialog()

  const handleSettingsClick = () => {
    if (isSignedIn) {
      openSettings()
    } else {
      router.push('/auth')
    }
  }

  return (
    <>
      {/* Settings & Theme Switcher - Always visible */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <div className="surface-glass flex items-center gap-0.5 rounded-lg p-1">
          <ThemeSwitcher />

          <div className="control-divider" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSettingsClick}
                className="control-button"
                aria-label={isSignedIn ? 'Settings' : 'Sign in to access settings'}
              >
                <Settings />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{isSignedIn ? 'Settings' : 'Sign in to access settings'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Menu and New Chat buttons for mobile/collapsed sidebar */}
      <div
        className={cn(
          'absolute top-2.5 left-2.5 z-30 transition-opacity duration-200',
          effectiveSidebarOpen ? 'md:pointer-events-none md:opacity-0' : 'opacity-100',
        )}
      >
        <div className="surface-glass flex items-center gap-0.5 rounded-lg p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onToggleSidebar} className="control-button" aria-label="Open sidebar">
                <Menu className="md:hidden" />
                <ChevronsRight className="hidden md:block" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open sidebar</TooltipContent>
          </Tooltip>

          <div className="control-divider" />

          <Tooltip>
            <TooltipTrigger asChild>
              {/* span keeps the tooltip working while the button is disabled */}
              <span className="inline-flex">
                <button onClick={onNewChat} className="control-button" disabled={isOnHomePage} aria-label="New conversation">
                  <Plus />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{isOnHomePage ? 'Already on home page' : 'New conversation'}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )
}
