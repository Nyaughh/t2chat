import { db } from '@/lib/dexie'
import { toast } from 'sonner'

/**
 * Wipe every piece of chat data and preference this browser holds (Dexie, all IndexedDB
 * databases, T2Chat localStorage/sessionStorage keys). Run after sign-out so the next
 * person on this device starts clean.
 */
export async function clearAllLocalData() {
  try {
    // First try to clear Dexie databases
    try {
      await db.conversations.clear()
      await db.messages.clear()
    } catch (dexieError) {
      console.warn('Failed to clear Dexie databases:', dexieError)
    }

    // Clear all IndexedDB databases completely
    try {
      if ('indexedDB' in window) {
        // Get all database names
        const databases = await indexedDB.databases()

        // Delete each database
        for (const dbInfo of databases) {
          if (dbInfo.name) {
            console.log(`Deleting IndexedDB database: ${dbInfo.name}`)
            await new Promise((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(dbInfo.name!)
              deleteReq.onsuccess = () => {
                console.log(`Successfully deleted database: ${dbInfo.name}`)
                resolve(undefined)
              }
              deleteReq.onerror = () => {
                console.warn(`Failed to delete database: ${dbInfo.name}`)
                resolve(undefined) // Don't reject, just continue
              }
              deleteReq.onblocked = () => {
                console.warn(`Database deletion blocked: ${dbInfo.name}`)
                resolve(undefined) // Don't reject, just continue
              }
            })
          }
        }
      }
    } catch (indexedDbError) {
      console.warn('Failed to clear IndexedDB:', indexedDbError)
    }

    // Clear all localStorage
    try {
      // Clear specific known keys first
      const localStorageKeys = [
        'lastUsedModelId', // Last selected model
        't2chat-sidebar-open', // Sidebar state
        'mainFont', // Font preferences
        'codeFont', // Code font preferences
        'selectedVoiceURI', // Speech synthesis voice
        'thinkingEnabled', // AI thinking mode
        'webSearchEnabled', // Web search toggle
        'groupBy', // Model grouping preference
      ]

      localStorageKeys.forEach((key) => {
        localStorage.removeItem(key)
      })

      // Clear any other t2chat related localStorage items
      const allKeys = Object.keys(localStorage)
      allKeys.forEach((key) => {
        if (key.startsWith('t2chat-') || key.startsWith('t2Chat')) {
          localStorage.removeItem(key)
        }
      })

      console.log('Cleared localStorage')
    } catch (localStorageError) {
      console.warn('Failed to clear localStorage:', localStorageError)
    }

    // Clear sessionStorage as well
    try {
      const sessionKeys = Object.keys(sessionStorage)
      sessionKeys.forEach((key) => {
        if (key.startsWith('t2chat-') || key.startsWith('t2Chat')) {
          sessionStorage.removeItem(key)
        }
      })
      console.log('Cleared sessionStorage')
    } catch (sessionStorageError) {
      console.warn('Failed to clear sessionStorage:', sessionStorageError)
    }

    console.log('All local data cleared successfully')
    toast.success('Local data cleared successfully')
  } catch (error) {
    console.error('Error clearing local data:', error)
    toast.error('Failed to clear local data')
  }
}
