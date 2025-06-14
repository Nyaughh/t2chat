'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export function useScrollToBottom(activeMessages: any[]) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

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
    if (isAtBottomRef.current) {
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