'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WifiOff, MessageSquare, Clock, RefreshCw } from 'lucide-react'
import { workerManager } from '@/lib/worker-manager'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const [cachedChats, setCachedChats] = useState<any[]>([])
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine)

    // Load cached chats
    loadCachedChats()

    // Listen for online status changes
    const handleOnline = () => {
      setIsOnline(true)
      // Redirect to main app when back online
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadCachedChats = async () => {
    try {
      const chats = await workerManager.getCachedChats()
      setCachedChats(chats)
    } catch (error) {
      console.error('Failed to load cached chats:', error)
    }
  }

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    
    // Simulate checking connection
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = '/'
      }
    }, 1000)
  }

  const handleViewChat = (chatId: string) => {
    // Navigate to cached chat
    window.location.href = `/chat/${chatId}?offline=true`
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <WifiOff className="h-16 w-16 text-muted-foreground" />
              <div className="absolute -bottom-1 -right-1">
                <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">You're Offline</h1>
            <p className="text-muted-foreground">
              {isOnline 
                ? "Connection restored! Redirecting..." 
                : "No internet connection detected. You can still view your cached chats below."
              }
            </p>
          </div>

          {!isOnline && (
            <Button onClick={handleRetry} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again {retryCount > 0 && `(${retryCount})`}
            </Button>
          )}
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              Connection Status
            </CardTitle>
            <CardDescription>
              {isOnline 
                ? "Your internet connection has been restored"
                : "You're currently offline but can access cached content"
              }
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Cached Chats */}
        {cachedChats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Cached Chats ({cachedChats.length})
              </CardTitle>
              <CardDescription>
                These chats are available offline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cachedChats.slice(0, 10).map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleViewChat(chat.id)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {chat.title || 'Untitled Chat'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {chat.messageCount || 0} messages
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
              
              {cachedChats.length > 10 && (
                <p className="text-center text-sm text-muted-foreground">
                  And {cachedChats.length - 10} more chats available offline
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features Available Offline */}
        <Card>
          <CardHeader>
            <CardTitle>Available Offline</CardTitle>
            <CardDescription>
              Features you can use without an internet connection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">✅ Available</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View cached chats</li>
                  <li>• Read message history</li>
                  <li>• Search cached messages</li>
                  <li>• Export chat data</li>
                  <li>• View attachments</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">❌ Requires Internet</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Send new messages</li>
                  <li>• AI responses</li>
                  <li>• Upload files</li>
                  <li>• Web search</li>
                  <li>• Real-time sync</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Offline Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-2">
              <p>💡 <strong>Tip:</strong> Messages you try to send offline will be queued and sent automatically when you're back online.</p>
              <p>🔄 <strong>Sync:</strong> Your chats will sync automatically when connection is restored.</p>
              <p>💾 <strong>Storage:</strong> We cache your recent chats locally for offline access.</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>T2 Chat - Powered by Service Workers for offline functionality</p>
        </div>
      </div>
    </div>
  )
} 