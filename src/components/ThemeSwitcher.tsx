'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Show a fallback icon to prevent hydration flash
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="control-button" disabled aria-label="Theme switcher">
            <div className="size-[18px] rounded-full bg-rose-600/50 animate-pulse dark:bg-rose-300/50" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Theme switcher</TooltipContent>
      </Tooltip>
    )
  }

  const toggleTheme = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      })
    } else {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleTheme}
          className="control-button"
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} mode</TooltipContent>
    </Tooltip>
  )
}

export default ThemeSwitcher
