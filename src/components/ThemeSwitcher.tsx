'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Show a fallback icon to prevent hydration flash
    return (
      <button
        className="relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5.5 w-5.5 p-0 hover:bg-transparent"
        title="Theme switcher"
        disabled
      >
        <Sun className="w-4.5 h-4.5" />
      </button>
    )
  }

  const toggleTheme = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
      })
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative z-10 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 h-5.5 w-5.5 p-0 hover:bg-transparent"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Moon className="w-4.5 h-4.5" />
      ) : (
        <Sun className="w-4.5 h-4.5" />
      )}
    </button>
  )
}

export default ThemeSwitcher
