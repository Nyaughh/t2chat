'use client'

import { Clock, AlertCircle, RotateCcw, X, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

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

interface PendingMessageItemProps {
  message: PendingMessage
  isOnline: boolean
  onRetry: (messageId: string) => void
  onRemove: (messageId: string) => void
}

export function PendingMessageItem({ 
  message, 
  isOnline, 
  onRetry, 
  onRemove 
}: PendingMessageItemProps) {
  const hasAttachments = message.attachments && message.attachments.length > 0
  const isStale = message.attempts >= 3
  const timeAgo = formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })

  return (
    <div className="flex justify-end">
      <div className="group flex flex-col gap-2 max-w-[85%] min-w-0">
        <div
          className={cn(
            'px-4 py-3 break-words overflow-wrap-anywhere rounded-lg border-2 border-dashed transition-all',
            isStale 
              ? 'bg-red-50/80 dark:bg-red-900/20 border-red-300/60 dark:border-red-600/40' 
              : 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-300/60 dark:border-amber-600/40'
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {!isOnline ? (
                <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              ) : isStale ? (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
              
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs border-0 font-medium',
                  isStale 
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                )}
              >
                {isStale ? 'Failed' : isOnline ? 'Sending...' : 'Queued'}
              </Badge>
              
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {timeAgo}
              </span>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {(isOnline || isStale) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetry(message.id)}
                  className="h-6 w-6 p-0 hover:bg-amber-200/50 dark:hover:bg-amber-800/30"
                  title="Retry sending"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(message.id)}
                className="h-6 w-6 p-0 hover:bg-red-200/50 dark:hover:bg-red-800/30"
                title="Remove message"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">
            {message.content}
          </div>
          
          {/* Show attachments if any */}
          {hasAttachments && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>📎 {message.attachments!.length} attachment{message.attachments!.length > 1 ? 's' : ''}</span>
            </div>
          )}
          
          {/* Show options if any */}
          {(message.options?.webSearch || message.options?.imageGen) && (
            <div className="mt-2 flex gap-2">
              {message.options.webSearch && (
                <Badge variant="outline" className="text-xs">
                  Web Search
                </Badge>
              )}
              {message.options.imageGen && (
                <Badge variant="outline" className="text-xs">
                  Image Generation
                </Badge>
              )}
            </div>
          )}
          
          {/* Show attempt count if > 0 */}
          {message.attempts > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Attempt {message.attempts + 1}/3
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 