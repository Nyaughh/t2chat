'use client'

import { useState, useEffect, useCallback } from 'react'
import { workerManager } from '@/lib/worker-manager'
import { toast } from 'sonner'

interface PendingMessage {
  id: string
  chatId?: string
  content: string
  role: 'user' | 'assistant'
  modelId: string
  attachments?: any[]
  timestamp: number
  attempts: number
  options?: {
    webSearch?: boolean
    imageGen?: boolean
  }
}

interface OfflineState {
  isOnline: boolean
  pendingMessages: PendingMessage[]
  isSyncing: boolean
}

export function useOfflineSync() {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingMessages: [],
    isSyncing: false
  })

  // Load pending messages from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedPending = localStorage.getItem('pendingMessages')
    if (savedPending) {
      try {
        const parsed = JSON.parse(savedPending)
        setOfflineState(prev => ({
          ...prev,
          pendingMessages: parsed
        }))
      } catch (error) {
        console.error('Failed to parse pending messages:', error)
        localStorage.removeItem('pendingMessages')
      }
    }
  }, [])

  // Save pending messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    localStorage.setItem('pendingMessages', JSON.stringify(offlineState.pendingMessages))
  }, [offlineState.pendingMessages])

  // Set up online/offline event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      console.log('[OfflineSync] Network back online')
      setOfflineState(prev => ({ ...prev, isOnline: true }))
      
      toast.success('Back online!', {
        description: 'Connection restored. Syncing queued messages...',
        duration: 3000,
      })
      
      // Trigger sync when coming back online with a small delay
      setTimeout(() => {
        syncPendingMessages()
      }, 1000)
    }

    const handleOffline = () => {
      console.log('[OfflineSync] Network went offline')
      setOfflineState(prev => ({ ...prev, isOnline: false }))
      
      toast.warning('Connection lost', {
        description: 'You\'re now offline. Messages will be queued and sent when connection is restored.',
        duration: 5000,
      })
    }

    // Check initial connection state
    const updateConnectionState = () => {
      const isOnline = navigator.onLine
      setOfflineState(prev => ({ ...prev, isOnline }))
      
      if (!isOnline) {
        toast.warning('You appear to be offline', {
          description: 'Some features may not work properly.',
          duration: 3000,
        })
      }
    }

    // Listen for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Also listen for visibility change to check connection when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        updateConnectionState()
      }
    })

    // Initial state check
    updateConnectionState()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', updateConnectionState)
    }
  }, [])

  // Add message to pending queue when offline
  const queueMessage = useCallback((messageData: Omit<PendingMessage, 'id' | 'timestamp' | 'attempts'>) => {
    const pendingMessage: PendingMessage = {
      ...messageData,
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      attempts: 0
    }

    setOfflineState(prev => ({
      ...prev,
      pendingMessages: [...prev.pendingMessages, pendingMessage]
    }))

    toast.info('Message queued', {
      description: 'Your message will be sent when you\'re back online.',
      duration: 3000,
    })

    return pendingMessage.id
  }, [])

  // Remove message from pending queue
  const removePendingMessage = useCallback((messageId: string) => {
    setOfflineState(prev => ({
      ...prev,
      pendingMessages: prev.pendingMessages.filter(msg => msg.id !== messageId)
    }))
  }, [])

  // Update message attempts
  const incrementMessageAttempts = useCallback((messageId: string) => {
    setOfflineState(prev => ({
      ...prev,
      pendingMessages: prev.pendingMessages.map(msg =>
        msg.id === messageId ? { ...msg, attempts: msg.attempts + 1 } : msg
      )
    }))
  }, [])

  // Sync pending messages when online
  const syncPendingMessages = useCallback(async () => {
    if (!offlineState.isOnline || offlineState.pendingMessages.length === 0) {
      return
    }

    setOfflineState(prev => ({ ...prev, isSyncing: true }))

    const messagesToSync = [...offlineState.pendingMessages]
    let successCount = 0
    let failureCount = 0

    for (const message of messagesToSync) {
      try {
        // Here you would call your actual message sending API
        // For now, we'll simulate with a delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // On success, remove from pending
        removePendingMessage(message.id)
        successCount++
        
        console.log('Synced pending message:', message.id)
      } catch (error) {
        console.error('Failed to sync message:', message.id, error)
        
        // Increment attempts
        incrementMessageAttempts(message.id)
        
        // Remove if too many attempts
        if (message.attempts >= 3) {
          removePendingMessage(message.id)
          failureCount++
        }
      }
    }

    setOfflineState(prev => ({ ...prev, isSyncing: false }))

    // Show sync results
    if (successCount > 0) {
      toast.success(`Synced ${successCount} message${successCount > 1 ? 's' : ''}`, {
        description: 'Your offline messages have been sent.',
      })
    }

    if (failureCount > 0) {
      toast.error(`Failed to sync ${failureCount} message${failureCount > 1 ? 's' : ''}`, {
        description: 'Some messages could not be sent after multiple attempts.',
      })
    }
  }, [offlineState.isOnline, offlineState.pendingMessages, removePendingMessage, incrementMessageAttempts])

  // Clear all pending messages
  const clearPendingMessages = useCallback(() => {
    setOfflineState(prev => ({
      ...prev,
      pendingMessages: []
    }))
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pendingMessages')
    }
  }, [])

  // Retry specific message
  const retryMessage = useCallback(async (messageId: string) => {
    const message = offlineState.pendingMessages.find(msg => msg.id === messageId)
    if (!message) return

    try {
      // Simulate retry logic
      await new Promise(resolve => setTimeout(resolve, 1000))
      removePendingMessage(messageId)
      
      toast.success('Message sent successfully')
    } catch (error) {
      incrementMessageAttempts(messageId)
      toast.error('Failed to send message')
    }
  }, [offlineState.pendingMessages, removePendingMessage, incrementMessageAttempts])

  return {
    isOnline: offlineState.isOnline,
    pendingMessages: offlineState.pendingMessages,
    isSyncing: offlineState.isSyncing,
    queueMessage,
    removePendingMessage,
    syncPendingMessages,
    clearPendingMessages,
    retryMessage,
  }
} 