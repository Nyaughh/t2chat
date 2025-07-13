'use client'
import { useState, useEffect, useCallback } from 'react'
import { useMediaQuery } from 'react-responsive'
import Cookies from 'js-cookie'

const SIDEBAR_COOKIE_NAME = 't2chat-sidebar-open'

export function useIsMobile() {
  const isMobile = useMediaQuery({ query: '(max-width: 767px)' })
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted && isMobile
}

export function useSidebar() {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const cookieValue = Cookies.get(SIDEBAR_COOKIE_NAME)
    const initial = cookieValue !== undefined ? cookieValue === 'true' : true

    if (isMobile) {
      setSidebarOpen(false)
    } else {
      setSidebarOpen(initial)
    }
  }, [isMobile])

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
