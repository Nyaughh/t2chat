'use client'
import { useIsMobile } from './use-mobile'
import { useState, useEffect, useCallback } from 'react'

export function useSidebar() {
  const isMobile = useIsMobile()

  // Initialize state based on localStorage (desktop) or always false for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Only run in the browser
    if (typeof window === 'undefined') return

    if (!isMobile) {
      const saved = localStorage.getItem('t2chat-sidebar-open')
      setSidebarOpen(saved !== null ? saved === 'true' : true)
    } else {
      setSidebarOpen(false) // Always start closed on mobile
    }
  }, [isMobile])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(open => {
      const newState = !open
      // Save preference to localStorage on desktop only
      if (typeof window !== 'undefined' && !isMobile) {
        localStorage.setItem('t2chat-sidebar-open', newState.toString())
      }
      return newState
    })
  }, [isMobile])

  return { sidebarOpen, toggleSidebar, isDesktop: !isMobile }
}
