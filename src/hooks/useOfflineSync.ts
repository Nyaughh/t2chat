'use client'

import { useEffect, useState, useCallback } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { toast } from 'sonner'

// Store for pending messages
let pendingMessages: Array<{
  id: string
  chatId?: string
  content: string
  role: 'user' | 'assistant'
  modelId: string
  attachments?: Array<{
    name: string
    type: string
    size: number
    url: string
  }>
  options?: {
    webSearch?: boolean
    imageGen?: boolean
  }
  timestamp: number
}> = []

// Worker manager instance
let workerManagerInstance: any = null

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [workersInitialized, setWorkersInitialized] = useState(false)

  const addMessage = useMutation(api.chat.mutations.addMessage)

  // Initialize workers on first use
  useEffect(() => {
    if (typeof window === 'undefined' || workersInitialized) return

    const initWorkers = async () => {
      try {
        // Import worker manager safely
        const { workerManager } = await import('@/lib/worker-manager')
        workerManagerInstance = workerManager

        if (workerManagerInstance) {
          await workerManagerInstance.initialize()
          setWorkersInitialized(true)
          console.log('[useOfflineSync] Workers initialized successfully')

          // Show notification if service worker is available
          if ('serviceWorker' in navigator && !localStorage.getItem('sw-notification-shown')) {
            toast.success('App is now available offline!', {
              description: 'Your chats will sync automatically when you\'re back online.',
              duration: 5000,
            })
            localStorage.setItem('sw-notification-shown', 'true')
          }
        }
      } catch (error) {
        console.error('[useOfflineSync] Failed to initialize workers:', error)
      }
    }

    initWorkers()
  }, [workersInitialized])

  // Monitor online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Back online!', {
        description: 'Connection restored. Syncing data...',
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.warning('You\'re offline', {
        description: 'Chat is now read-only. Messages will sync when back online.',
        duration: 5000,
      })
    }

    // Set initial status
    updateOnlineStatus()

    // Listen for changes
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update pending count when pendingMessages changes
  useEffect(() => {
    setPendingCount(pendingMessages.length)
  }, [])

  const queueMessage = useCallback((message: {
    chatId?: string
    content: string
    role: 'user' | 'assistant'
    modelId: string
    attachments?: Array<{
      name: string
      type: string
      size: number
      url: string
    }>
    options?: {
      webSearch?: boolean
      imageGen?: boolean
    }
  }) => {
    const pendingMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: Date.now(),
    }

    pendingMessages.push(pendingMessage)
    setPendingCount(pendingMessages.length)

    // Store in localStorage for persistence
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages))
    }

    console.log('[useOfflineSync] Message queued:', pendingMessage)
  }, [])

  const syncPendingMessages = useCallback(async () => {
    if (!isOnline || pendingMessages.length === 0 || isSyncing) return

    setIsSyncing(true)

    try {
      const messagesToSync = [...pendingMessages]
      
      for (const message of messagesToSync) {
        try {
          if (message.chatId) {
            await addMessage({
              chatId: message.chatId as Id<'chats'>,
              role: message.role,
              content: message.content,
              modelId: message.modelId,
            })
          }

          // Remove successfully synced message
          pendingMessages = pendingMessages.filter(m => m.id !== message.id)
        } catch (error) {
          console.error('[useOfflineSync] Failed to sync message:', error)
          break // Stop syncing on first error
        }
      }

      // Update localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages))
      }

      setPendingCount(pendingMessages.length)

      if (messagesToSync.length > 0) {
        toast.success('Messages synced successfully')
      }
    } catch (error) {
      console.error('[useOfflineSync] Sync failed:', error)
      toast.error('Failed to sync messages')
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing, addMessage])

  const retryMessage = useCallback(async (messageId: string) => {
    if (!isOnline) return

    const message = pendingMessages.find(m => m.id === messageId)
    if (!message) return

    try {
      if (message.chatId) {
        await addMessage({
          chatId: message.chatId as Id<'chats'>,
          role: message.role,
          content: message.content,
          modelId: message.modelId,
        })
      }

      // Remove successfully synced message
      pendingMessages = pendingMessages.filter(m => m.id !== messageId)
      setPendingCount(pendingMessages.length)

      // Update localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages))
      }

      toast.success('Message sent successfully')
    } catch (error) {
      console.error('[useOfflineSync] Failed to retry message:', error)
      toast.error('Failed to send message')
    }
  }, [isOnline, addMessage])

  const removePendingMessage = useCallback((messageId: string) => {
    pendingMessages = pendingMessages.filter(m => m.id !== messageId)
    setPendingCount(pendingMessages.length)

    // Update localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pendingMessages', JSON.stringify(pendingMessages))
    }
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        syncPendingMessages()
      }, 1000) // Wait 1 second after coming online

      return () => clearTimeout(timeoutId)
    }
  }, [isOnline, syncPendingMessages])

  // Load pending messages from localStorage on init
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('pendingMessages')
      if (stored) {
        try {
          pendingMessages = JSON.parse(stored)
          setPendingCount(pendingMessages.length)
        } catch (error) {
          console.error('[useOfflineSync] Failed to parse stored messages:', error)
        }
      }
    }
  }, [])

  return {
    isOnline,
    pendingMessages: pendingMessages,
    pendingCount,
    isSyncing,
    workersInitialized,
    queueMessage,
    syncPendingMessages,
    retryMessage,
    removePendingMessage,
  }
} 