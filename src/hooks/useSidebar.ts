'use client'
import { useState, useEffect, useCallback } from 'react'
import { useMediaQuery } from 'react-responsive'
import Cookies from 'js-cookie'

const SIDEBAR_COOKIE_NAME = 't2chat-sidebar-open'

export function useIsMobile() {
  const isMobile = useMediaQuery({ maxWidth: 767 })
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted && isMobile
}

export function useSidebar(initialState: boolean) {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(initialState)

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false) // Always start closed on mobile
    } else {
      setSidebarOpen(initialState)
    }
  }, [isMobile, initialState])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      const newState = !open
      if (!isMobile) {
        Cookies.set(SIDEBAR_COOKIE_NAME, newState.toString(), { expires: 365 })
      }
      return newState
    })
  }, [isMobile])

  return { sidebarOpen, toggleSidebar }
}
