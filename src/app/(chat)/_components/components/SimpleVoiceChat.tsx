'use client'

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Phone, PhoneOff, MessageSquare, User, Settings2, Sparkles, X, Volume2, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSimpleVoiceChat } from '@/hooks/useSimpleVoiceChat'
import { ModelInfo } from '@/lib/models'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import MessageRenderer from '@/components/MessageRenderer'

interface SimpleVoiceChatProps {
  isOpen: boolean
  onClose: () => void
  onSaveConversation: (conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<void>
  onSendMessage?: (
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => Promise<string>
  selectedModel?: ModelInfo
  onModelChange?: (model: ModelInfo) => void
  availableModels?: ModelInfo[]
}

export function SimpleVoiceChat({
  isOpen,
  onClose,
  onSaveConversation,
  onSendMessage,
  selectedModel,
  onModelChange,
  availableModels = [],
}: SimpleVoiceChatProps) {
  // Fetch user settings for context display
  const userSettings = useQuery(api.users.getMySettings)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const sendMessageWithModel = onSendMessage
    ? (message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) =>
        onSendMessage(message, conversationHistory)
    : undefined

  const {
    isActive,
    isListening,
    isSpeaking,
    transcript,
    conversationHistory,
    startVoiceChat,
    endVoiceChat,
    isSupported,
  } = useSimpleVoiceChat(sendMessageWithModel)

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationHistory])

  // Stop audio and voice chat when component closes
  useEffect(() => {
    if (!isOpen) {
      // Stop speech synthesis immediately
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      // Stop any ongoing speech synthesis utterances
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const synth = window.speechSynthesis
        if (synth.speaking) {
          synth.cancel()
        }
      }

      // End voice chat if active
      if (isActive) {
        endVoiceChat()
      }
    }
  }, [isOpen, isActive, endVoiceChat])

  // Also stop audio when component unmounts
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleStart = () => {
    startVoiceChat()
  }

  const handleEnd = async () => {
    // Stop speech synthesis immediately
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    endVoiceChat()
    if (conversationHistory.length > 0) {
      await onSaveConversation(conversationHistory)
    }
    onClose()
  }

  const handleClose = () => {
    // Stop speech synthesis when closing
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    // Stop any ongoing speech synthesis utterances
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const synth = window.speechSynthesis
      if (synth.speaking) {
        synth.cancel()
      }
    }

    if (isActive) {
      endVoiceChat()
    }
    onClose()
  }

  // Handle escape key to close and stop audio
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  const getStatus = () => {
    if (!isActive) return 'Ready to start voice conversation'
    if (isListening) return 'Listening to your voice...'
    if (isSpeaking) return 'AI is speaking...'
    return 'Processing your request...'
  }

  const getStatusColor = () => {
    if (!isActive) return 'text-rose-500/70 dark:text-rose-300/70'
    if (isListening) return 'text-green-500 dark:text-green-400'
    if (isSpeaking) return 'text-purple-500 dark:text-purple-400'
    return 'text-blue-500 dark:text-blue-400'
  }

  const getUserContext = () => {
    if (!userSettings) return null

    const context = []
    if (userSettings.userName) context.push(`Name: ${userSettings.userName}`)
    if (userSettings.userRole) context.push(`Role: ${userSettings.userRole}`)
    if (userSettings.userTraits?.length) context.push(`Interests: ${userSettings.userTraits.join(', ')}`)

    return context.length > 0 ? context : null
  }

  const hasCustomPrompt = userSettings?.promptTemplate && userSettings.promptTemplate.trim().length > 0

  if (!isSupported) {
    return (
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="unsupported-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <Card className="border shadow-lg bg-background">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <MicOff className="w-8 h-8 text-rose-500 dark:text-rose-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">Voice Chat Not Supported</h3>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Your browser doesn't support speech recognition. Please try using Chrome, Edge, or Safari for the
                    best voice chat experience.
                  </p>
                  <Button onClick={handleClose} className="w-full">
                    Close
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="voice-chat-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isActive) {
              handleClose()
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg"
          >
            <Card className="border shadow-lg bg-background">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Voice Chat</h2>
                    <p className="text-sm text-muted-foreground">Natural conversation with AI</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    disabled={isActive}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Model Selection */}
                {!isActive && onModelChange && availableModels.length > 0 && (
                  <div className="mb-6 p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">AI Model</span>
                      <Select
                        value={selectedModel?.id}
                        onValueChange={(value) => {
                          const model = availableModels.find((m) => m.id === value)
                          if (model) onModelChange(model)
                        }}
                      >
                        <SelectTrigger className="w-48 bg-background">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.slice(0, 5).map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="text-center mb-6">
                  <p className={cn('text-sm font-medium mb-4', getStatusColor())}>{getStatus()}</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isListening ? 'bg-rose-500 animate-pulse' : 'bg-muted-foreground/30',
                        )}
                      />
                      <span className="text-xs text-muted-foreground">Listening</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isSpeaking ? 'bg-rose-500 animate-pulse' : 'bg-muted-foreground/30',
                        )}
                      />
                      <span className="text-xs text-muted-foreground">Speaking</span>
                    </div>
                  </div>
                </div>

                {/* Central Control */}
                <div className="flex justify-center mb-6">
                  {!isActive ? (
                    <Button
                      onClick={handleStart}
                      size="lg"
                      className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white"
                    >
                      <Phone className="w-8 h-8" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleEnd}
                      size="lg"
                      className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white"
                    >
                      <PhoneOff className="w-8 h-8" />
                    </Button>
                  )}
                </div>

                {/* Conversation History - Match normal chat UI */}
                {conversationHistory.length > 0 && (
                  <div
                    className="max-h-60 overflow-y-auto scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <div className="text-sm font-medium mb-4 text-muted-foreground">
                      Conversation ({conversationHistory.length} messages)
                    </div>
                    <div className="space-y-4">
                      {conversationHistory.map((msg, idx) => {
                        // Create a unique key using index, role, and content hash
                        const contentHash = msg.content.slice(0, 10).replace(/\s/g, '')
                        const uniqueKey = `message-${idx}-${msg.role}-${contentHash}-${Date.now()}`

                        return (
                          <div
                            key={uniqueKey}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={cn(
                                'group flex flex-col gap-2 min-w-0 focus:outline-none',
                                msg.role === 'user' ? 'max-w-[85%]' : 'w-full',
                              )}
                            >
                              <div
                                className={cn(
                                  'px-4 py-3 break-words overflow-wrap-anywhere text-base leading-relaxed',
                                  msg.role === 'user'
                                    ? 'bg-rose-500/5 dark:bg-rose-300/5 text-black dark:text-white rounded-lg'
                                    : 'text-black dark:text-white',
                                )}
                              >
                                {msg.role === 'assistant' ? (
                                  <MessageRenderer content={msg.content} modelId={selectedModel?.id} />
                                ) : (
                                  msg.content
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </AnimatePresence>
  )
}
