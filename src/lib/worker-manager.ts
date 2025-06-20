// Worker Manager - Coordinates service workers, web workers, and background jobs
// Provides a unified interface for worker management

interface WorkerManager {
  // Service Worker
  serviceWorker: ServiceWorkerRegistration | null
  
  // Web Workers
  messageWorker: Worker | null
  fileWorker: Worker | null
  
  // Worker states
  isInitialized: boolean
  isOnline: boolean
  
  // Event handlers
  onWorkerMessage: ((data: any) => void) | null
  onOfflineSync: ((success: boolean) => void) | null

  // Methods
  initialize(): Promise<void>
  cleanup(): void
  getStatus(): {
    isInitialized: boolean
    isOnline: boolean
    serviceWorker: boolean
    messageWorker: boolean
    fileWorker: boolean
  }
  
  // Message processing
  processMessage(messageData: any): Promise<any>
  indexMessages(messages: any[]): Promise<any>
  searchMessages(query: string, chatId?: string, limit?: number): Promise<any>
  
  // File processing  
  processImage(file: File, options?: any): Promise<any>
  extractText(file: File, type: 'pdf' | 'txt' | 'md'): Promise<any>
  validateFile(file: File, constraints: any): Promise<any>
  
  // Cache management
  cacheChat(chatData: any): Promise<void>
  getCachedChats(): Promise<any[]>
}

class T2ChatWorkerManager implements WorkerManager {
  serviceWorker: ServiceWorkerRegistration | null = null
  messageWorker: Worker | null = null
  fileWorker: Worker | null = null
  
  isInitialized = false
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  
  onWorkerMessage: ((data: any) => void) | null = null
  onOfflineSync: ((success: boolean) => void) | null = null
  
  private pendingTasks: Map<string, any> = new Map()
  private workerCallbacks: Map<string, (result: any) => void> = new Map()

  constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  // Initialize all workers
  async initialize(): Promise<void> {
    // Only run on client side
    if (typeof window === 'undefined') {
      console.warn('[WorkerManager] Skipping initialization on server side')
      return
    }

    if (this.isInitialized) return

    try {
      // Initialize service worker
      await this.initServiceWorker()
      
      // Initialize web workers
      await this.initWebWorkers()
      
      // Setup event listeners
      this.setupEventListeners()
      
      this.isInitialized = true
      console.log('[WorkerManager] All workers initialized successfully')
    } catch (error) {
      console.error('[WorkerManager] Failed to initialize workers:', error)
      throw error
    }
  }

  // Initialize service worker
  private async initServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[WorkerManager] Service Worker not supported')
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      this.serviceWorker = registration

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[WorkerManager] New service worker available')
              // Optionally prompt user to refresh
              this.notifyServiceWorkerUpdate()
            }
          })
        }
      })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data)
      })

      console.log('[WorkerManager] Service Worker registered successfully')
    } catch (error) {
      console.error('[WorkerManager] Service Worker registration failed:', error)
    }
  }

  // Initialize web workers
  private async initWebWorkers(): Promise<void> {
    if (typeof Worker === 'undefined') {
      console.warn('[WorkerManager] Web Workers not supported in this environment')
      return
    }

    try {
      // Initialize message processing worker
      this.messageWorker = new Worker('/src/workers/message-processor.worker.ts', {
        type: 'module'
      })
      
      this.messageWorker.onmessage = (event) => {
        this.handleWebWorkerMessage('message', event.data)
      }
      
      this.messageWorker.onerror = (error) => {
        console.error('[WorkerManager] Message worker error:', error)
      }

      // Initialize file processing worker
      this.fileWorker = new Worker('/src/workers/file-processor.worker.ts', {
        type: 'module'
      })
      
      this.fileWorker.onmessage = (event) => {
        this.handleWebWorkerMessage('file', event.data)
      }
      
      this.fileWorker.onerror = (error) => {
        console.error('[WorkerManager] File worker error:', error)
      }

      console.log('[WorkerManager] Web Workers initialized successfully')
    } catch (error) {
      console.error('[WorkerManager] Web Workers initialization failed:', error)
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    if (typeof window === 'undefined') {
      console.warn('[WorkerManager] Skipping event listeners setup on server side')
      return
    }

    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true
      this.handleOnlineStatusChange(true)
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.handleOnlineStatusChange(false)
    })

    // Page visibility for background sync
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isOnline) {
          this.triggerBackgroundSync()
        }
      })
    }
  }

  // Handle service worker messages
  private handleServiceWorkerMessage(data: any): void {
    const { type, payload } = data

    switch (type) {
      case 'SYNC_SUCCESS':
        console.log('[WorkerManager] Background sync successful:', payload)
        if (this.onOfflineSync) {
          this.onOfflineSync(true)
        }
        break

      case 'SYNC_FAILED':
        console.log('[WorkerManager] Background sync failed:', payload)
        if (this.onOfflineSync) {
          this.onOfflineSync(false)
        }
        break

      case 'CACHE_UPDATED':
        console.log('[WorkerManager] Cache updated:', payload)
        break

      default:
        console.log('[WorkerManager] Unknown service worker message:', type)
    }

    if (this.onWorkerMessage) {
      this.onWorkerMessage(data)
    }
  }

  // Handle web worker messages
  private handleWebWorkerMessage(workerType: string, data: any): void {
    const { type, payload } = data

    // Handle worker ready state
    if (type === 'WORKER_READY') {
      console.log(`[WorkerManager] ${workerType} worker ready:`, payload.message)
      return
    }

    // Handle errors
    if (type === 'ERROR') {
      console.error(`[WorkerManager] ${workerType} worker error:`, payload)
      return
    }

    // Execute callback if exists
    const callbackKey = `${workerType}_${payload.id || 'general'}`
    const callback = this.workerCallbacks.get(callbackKey)
    if (callback) {
      callback(payload)
      this.workerCallbacks.delete(callbackKey)
    }

    if (this.onWorkerMessage) {
      this.onWorkerMessage({ workerType, ...data })
    }
  }

  // Handle online status changes
  private handleOnlineStatusChange(isOnline: boolean): void {
    console.log('[WorkerManager] Online status changed:', isOnline)
    
    if (isOnline) {
      // Trigger background sync when coming online
      this.triggerBackgroundSync()
    }
  }

  // Trigger background sync
  private triggerBackgroundSync(): void {
    if (this.serviceWorker?.active) {
      this.serviceWorker.active.postMessage({
        type: 'TRIGGER_SYNC'
      })
    }
  }

  // Message processing methods
  async processMessage(messageData: any): Promise<any> {
    if (!this.messageWorker) {
      throw new Error('Message worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString()
      this.workerCallbacks.set(`message_${id}`, resolve)

      this.messageWorker!.postMessage({
        type: 'PROCESS_MESSAGE',
        payload: { id, ...messageData }
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        this.workerCallbacks.delete(`message_${id}`)
        reject(new Error('Message processing timeout'))
      }, 30000)
    })
  }

  async indexMessages(messages: any[]): Promise<any> {
    if (!this.messageWorker) {
      throw new Error('Message worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString()
      this.workerCallbacks.set(`message_${id}`, resolve)

      this.messageWorker!.postMessage({
        type: 'INDEX_MESSAGES',
        payload: { messages }
      })

      // Timeout after 60 seconds for large batches
      setTimeout(() => {
        this.workerCallbacks.delete(`message_${id}`)
        reject(new Error('Message indexing timeout'))
      }, 60000)
    })
  }

  async searchMessages(query: string, chatId?: string, limit?: number): Promise<any> {
    if (!this.messageWorker) {
      throw new Error('Message worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString()
      this.workerCallbacks.set(`message_${id}`, resolve)

      this.messageWorker!.postMessage({
        type: 'SEARCH_MESSAGES',
        payload: { query, chatId, limit }
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        this.workerCallbacks.delete(`message_${id}`)
        reject(new Error('Message search timeout'))
      }, 10000)
    })
  }

  // File processing methods
  async processImage(file: File, options: any = {}): Promise<any> {
    if (!this.fileWorker) {
      throw new Error('File worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString()
      this.workerCallbacks.set(`file_${id}`, resolve)

      this.fileWorker!.postMessage({
        type: 'PROCESS_IMAGE',
        payload: { id, file, options }
      })

      // Timeout after 60 seconds for large images
      setTimeout(() => {
        this.workerCallbacks.delete(`file_${id}`)
        reject(new Error('Image processing timeout'))
      }, 60000)
    })
  }

  async extractText(file: File, type: 'pdf' | 'txt' | 'md'): Promise<any> {
    if (!this.fileWorker) {
      throw new Error('File worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString()
      this.workerCallbacks.set(`file_${id}`, resolve)

      this.fileWorker!.postMessage({
        type: 'EXTRACT_TEXT',
        payload: { id, file, type }
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        this.workerCallbacks.delete(`file_${id}`)
        reject(new Error('Text extraction timeout'))
      }, 30000)
    })
  }

  async validateFile(file: File, constraints: any): Promise<any> {
    if (!this.fileWorker) {
      throw new Error('File worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString()
      this.workerCallbacks.set(`file_${id}`, resolve)

      this.fileWorker!.postMessage({
        type: 'VALIDATE_FILE',
        payload: { id, file, constraints }
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        this.workerCallbacks.delete(`file_${id}`)
        reject(new Error('File validation timeout'))
      }, 5000)
    })
  }

  // Cache management
  async cacheChat(chatData: any): Promise<void> {
    if (this.serviceWorker?.active) {
      this.serviceWorker.active.postMessage({
        type: 'CACHE_CHAT',
        data: chatData
      })
    }
  }

  async getCachedChats(): Promise<any[]> {
    if (!this.serviceWorker?.active) {
      return []
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel()
      
      channel.port1.onmessage = (event) => {
        resolve(event.data.chats || [])
      }

      this.serviceWorker!.active!.postMessage({
        type: 'GET_CACHED_CHATS'
      }, [channel.port2])

      // Timeout after 5 seconds
      setTimeout(() => {
        resolve([])
      }, 5000)
    })
  }

  // Notification for service worker updates
  private notifyServiceWorkerUpdate(): void {
    // You can implement a custom notification system here
    console.log('[WorkerManager] Service worker update available')
    
    // Example: dispatch custom event
    window.dispatchEvent(new CustomEvent('sw-update-available'))
  }

  // Cleanup workers
  cleanup(): void {
    if (this.messageWorker) {
      this.messageWorker.terminate()
      this.messageWorker = null
    }

    if (this.fileWorker) {
      this.fileWorker.terminate()
      this.fileWorker = null
    }

    this.workerCallbacks.clear()
    this.pendingTasks.clear()
    this.isInitialized = false

    console.log('[WorkerManager] Workers cleaned up')
  }

  // Get worker status
  getStatus(): {
    isInitialized: boolean
    isOnline: boolean
    serviceWorker: boolean
    messageWorker: boolean
    fileWorker: boolean
  } {
    return {
      isInitialized: this.isInitialized,
      isOnline: this.isOnline,
      serviceWorker: !!this.serviceWorker,
      messageWorker: !!this.messageWorker,
      fileWorker: !!this.fileWorker
    }
  }
}

// Export singleton instance - only create on client side
export const workerManager = typeof window !== 'undefined' ? new T2ChatWorkerManager() : ({
  // Provide mock implementation for server-side
  initialize: async () => Promise.resolve(),
  cleanup: () => {},
  getStatus: () => ({
    isInitialized: false,
    isOnline: false,
    serviceWorker: false,
    messageWorker: false,
    fileWorker: false
  }),
  processMessage: async () => Promise.resolve({}),
  indexMessages: async () => Promise.resolve({}),
  searchMessages: async () => Promise.resolve([]),
  processImage: async () => Promise.resolve({}),
  extractText: async () => Promise.resolve(''),
  validateFile: async () => Promise.resolve(true),
  cacheChat: async () => Promise.resolve(),
  getCachedChats: async () => Promise.resolve([]),
  onWorkerMessage: null,
  onOfflineSync: null,
  serviceWorker: null,
  messageWorker: null,
  fileWorker: null,
  isInitialized: false,
  isOnline: false
} as WorkerManager)

// Export types
export type { WorkerManager }
export default workerManager 