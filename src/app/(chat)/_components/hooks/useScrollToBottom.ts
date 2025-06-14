'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export function useScrollToBottom(activeMessages: any[]) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolled = useRef(false)

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const handleScroll = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]')
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 200
      isAtBottomRef.current = isAtBottom
      setShowScrollToBottom(!isAtBottom)
    }
  }, [])

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]')
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll)
      handleScroll() // Initial check
      return () => viewport.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    // For initial load with server messages, scroll immediately
    if (activeMessages.length > 0 && !hasInitialScrolled.current) {
      // Use timeout to ensure DOM has been updated
      setTimeout(() => {
        scrollToBottom('auto')
        hasInitialScrolled.current = true
      }, 50)
    } else if (isAtBottomRef.current) {
      // For subsequent messages, only scroll if already at bottom
      scrollToBottom('auto')
    }
  }, [activeMessages])

  return {
    showScrollToBottom,
    messagesEndRef,
    scrollAreaRef,
    scrollToBottom,
  }
} 