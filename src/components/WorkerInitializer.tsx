'use client'

import { useEffect, useState } from 'react'
import { workerManager } from '@/lib/worker-manager'
import { toast } from 'sonner'

export default function WorkerInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [workerStatus, setWorkerStatus] = useState({
    serviceWorker: false,
    messageWorker: false,
    fileWorker: false,
    isOnline: true
  })

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    initializeWorkers()
    setupEventListeners()
    
    return () => {
      // Cleanup on unmount
      workerManager.cleanup()
    }
  }, [])

  const initializeWorkers = async () => {
    // Additional client-side check
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      console.warn('[WorkerInitializer] Skipping worker initialization on server side')
      return
    }

    try {
      await workerManager.initialize()
      setInitialized(true)
      updateWorkerStatus()
      
      console.log('[WorkerInitializer] Workers initialized successfully')
      
      // Show notification if service worker is available but not used before
      if ('serviceWorker' in navigator && typeof localStorage !== 'undefined' && !localStorage.getItem('sw-notification-shown')) {
        toast.success('App is now available offline!', {
          description: 'Your chats will sync automatically when you\'re back online.',
          duration: 5000,
        })
        localStorage.setItem('sw-notification-shown', 'true')
      }
      
    } catch (error) {
      console.error('[WorkerInitializer] Failed to initialize workers:', error)
      toast.error('Some features may be limited', {
        description: 'Worker initialization failed. Offline features may not work.',
      })
    }
  }

  const updateWorkerStatus = () => {
    const status = workerManager.getStatus()
    setWorkerStatus(status)
  }

  const setupEventListeners = () => {
    // Additional client-side check
    if (typeof window === 'undefined') {
      console.warn('[WorkerInitializer] Skipping event listeners setup on server side')
      return
    }

    // Listen for worker messages
    workerManager.onWorkerMessage = (data) => {
      handleWorkerMessage(data)
    }

    // Listen for offline sync events
    workerManager.onOfflineSync = (success) => {
      if (success) {
        toast.success('Messages synced successfully', {
          description: 'Your offline messages have been sent.',
        })
      } else {
        toast.error('Sync failed', {
          description: 'Failed to sync offline messages. Will retry automatically.',
        })
      }
    }

    // Listen for service worker updates
    window.addEventListener('sw-update-available', () => {
      toast('App update available', {
        description: 'Refresh the page to get the latest version.',
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        },
        duration: 10000,
      })
    })

    // Listen for online/offline events
    window.addEventListener('online', () => {
      setWorkerStatus(prev => ({ ...prev, isOnline: true }))
      toast.success('Back online!', {
        description: 'Connection restored. Syncing data...',
      })
    })

    window.addEventListener('offline', () => {
      setWorkerStatus(prev => ({ ...prev, isOnline: false }))
      toast.warning('You\'re offline', {
        description: 'You can still view cached chats. Messages will sync when back online.',
        duration: 5000,
      })
    })

    // Listen for before install prompt (PWA)
    let deferredPrompt: any = null
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      
      // Show install prompt after a delay if not already installed
      setTimeout(() => {
        if (!window.matchMedia('(display-mode: standalone)').matches) {
          showInstallPrompt(deferredPrompt)
        }
      }, 30000) // Show after 30 seconds
    })

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      toast.success('App installed!', {
        description: 'T2 Chat is now available on your device.',
      })
      deferredPrompt = null
    })
  }

  const handleWorkerMessage = (data: any) => {
    const { type, workerType, payload } = data

    // Handle specific worker messages
    switch (type) {
      case 'CACHE_UPDATED':
        console.log('[WorkerInitializer] Cache updated:', payload)
        break
        
      case 'BACKGROUND_SYNC_COMPLETE':
        console.log('[WorkerInitializer] Background sync complete:', payload)
        break
        
      case 'WORKER_ERROR':
        console.error(`[WorkerInitializer] ${workerType} worker error:`, payload)
        break
        
      default:
        console.log(`[WorkerInitializer] Worker message:`, data)
    }
  }

  const showInstallPrompt = (promptEvent: any) => {
    if (!promptEvent) return

    toast('Install T2 Chat', {
      description: 'Add T2 Chat to your home screen for the best experience.',
      action: {
        label: 'Install',
        onClick: async () => {
          promptEvent.prompt()
          const { outcome } = await promptEvent.userChoice
          
          if (outcome === 'accepted') {
            console.log('[WorkerInitializer] User accepted the install prompt')
          } else {
            console.log('[WorkerInitializer] User dismissed the install prompt')
          }
        }
      },
      duration: 10000,
    })
  }

  // Component doesn't render anything visible - it's just for initialization
  return (
    <>
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg p-3 text-xs font-mono">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${initialized ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Workers: {initialized ? 'Ready' : 'Loading...'}</span>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <div>SW: {workerStatus.serviceWorker ? '✓' : '✗'}</div>
            <div>MSG: {workerStatus.messageWorker ? '✓' : '✗'}</div>
            <div>FILE: {workerStatus.fileWorker ? '✓' : '✗'}</div>
            <div>Online: {workerStatus.isOnline ? '✓' : '✗'}</div>
          </div>
        </div>
      )}
    </>
  )
} 