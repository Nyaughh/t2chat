'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export function useScrollToBottom(activeMessages: any[], isStreaming?: boolean) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const hasInitialScrolled = useRef(false)
  const userScrolledUpDuringStreamingRef = useRef(false)
  const lastMessageCountRef = useRef(0)
  const isStreamingRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const programmaticScrollRef = useRef(false)

  // Update streaming ref when isStreaming changes
  useEffect(() => {
    isStreamingRef.current = !!isStreaming
  }, [isStreaming])

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    programmaticScrollRef.current = true
    messagesEndRef.current?.scrollIntoView({ behavior })
    // Reset the user scroll flag when we programmatically scroll to bottom
    userScrolledUpDuringStreamingRef.current = false
    // Clear the programmatic flag after a short delay
    setTimeout(() => {
      programmaticScrollRef.current = false
    }, 100)
  }

  const handleScroll = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]')
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 200
      const wasAtBottom = isAtBottomRef.current
      const lastScrollTop = lastScrollTopRef.current

      isAtBottomRef.current = isAtBottom
      setShowScrollToBottom(!isAtBottom)

      // Detect any upward scroll during streaming (not programmatic)
      if (isStreamingRef.current && !programmaticScrollRef.current) {
        // If user scrolled up (even slightly) during streaming
        if (scrollTop < lastScrollTop) {
          userScrolledUpDuringStreamingRef.current = true
        }
        // Also catch the case where user was at bottom and scrolled up
        else if (wasAtBottom && !isAtBottom) {
          userScrolledUpDuringStreamingRef.current = true
        }
      }

      // If user scrolls back to bottom, reset the flag
      if (isAtBottom) {
        userScrolledUpDuringStreamingRef.current = false
      }

      // Update last scroll position
      lastScrollTopRef.current = scrollTop
    }
  }, [])

  // Reset the user scroll flag when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      userScrolledUpDuringStreamingRef.current = false
    }
  }, [isStreaming])

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]')
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll)
      handleScroll() // Initial check
      return () => viewport.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    const messageCount = activeMessages.length
    const messageCountChanged = messageCount !== lastMessageCountRef.current
    lastMessageCountRef.current = messageCount

    // For initial load with server messages, scroll immediately
    if (messageCount > 0 && !hasInitialScrolled.current) {
      // Use timeout to ensure DOM has been updated
      setTimeout(() => {
        scrollToBottom('auto')
        hasInitialScrolled.current = true
      }, 50)
      return
    }

    // Handle auto-scroll for new messages (when message count changes)
    if (messageCountChanged && isAtBottomRef.current) {
      // Don't auto-scroll if user scrolled up during streaming
      if (isStreaming && userScrolledUpDuringStreamingRef.current) {
        return
      }
      // For new messages, only scroll if already at bottom
      scrollToBottom('auto')
    }
  }, [activeMessages.length, isStreaming])

  // Handle auto-scroll during streaming content updates
  useEffect(() => {
    // Don't auto-scroll if user scrolled up during streaming
    if (isStreaming && userScrolledUpDuringStreamingRef.current) {
      return
    }

    // Auto-scroll during streaming if we're at the bottom
    if (isStreaming && isAtBottomRef.current && activeMessages.length > 0) {
      // Small delay to ensure content is rendered
      const timeoutId = setTimeout(() => {
        // Double-check we're still at bottom and user hasn't scrolled up
        if (isAtBottomRef.current && !userScrolledUpDuringStreamingRef.current) {
          scrollToBottom('auto')
        }
      }, 10)

      return () => clearTimeout(timeoutId)
    }
  }, [activeMessages, isStreaming]) // This effect handles content updates during streaming

  return {
    showScrollToBottom,
    messagesEndRef,
    scrollAreaRef,
    scrollToBottom,
  }
}
