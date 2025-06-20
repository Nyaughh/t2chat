'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WifiOff, Wifi, Clock, AlertTriangle, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface OfflineStatusIndicatorProps {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  onSync?: () => void
}

export function OfflineStatusIndicator({ 
  isOnline, 
  pendingCount, 
  isSyncing,
  onSync 
}: OfflineStatusIndicatorProps) {
  // Don't show anything if online and no pending messages
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                Offline
              </span>
            </>
          ) : isSyncing ? (
            <>
              <RotateCcw className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Syncing messages...
              </span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Back online
              </span>
            </>
          )}
          
          {pendingCount > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <Badge variant="secondary" className="text-xs">
                  {pendingCount} queued
                </Badge>
                {isOnline && onSync && !isSyncing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSync}
                    className="h-6 px-2 text-xs"
                  >
                    Sync now
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 