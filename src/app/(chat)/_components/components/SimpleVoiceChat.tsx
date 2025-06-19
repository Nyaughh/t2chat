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
    return ''
  }

  const getStatusColor = () => {
    if (!isActive) return 'text-rose-500/70 dark:text-rose-300/70'
    if (isListening) return 'text-white'
    if (isSpeaking) return 'text-white'
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
            className="w-full max-w-4xl"
          >
            <Card className="border shadow-lg bg-background relative">
              {/* Model Selection - Absolute Top Left Corner */}
              {!isActive && onModelChange && availableModels.length > 0 && (
                <div className="absolute top-2 left-2 z-10">
                  <Select
                    value={selectedModel?.id}
                    onValueChange={(value) => {
                      const model = availableModels.find((m) => m.id === value)
                      if (model) onModelChange(model)
                    }}
                  >
                    <SelectTrigger className="w-36 h-7 bg-background/80 border-muted hover:bg-background hover:border-border transition-colors text-xs backdrop-blur-sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.slice(0, 5).map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-xs">
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Close Button - Absolute Top Right Corner */}
              <div className="absolute top-2 right-2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  disabled={isActive}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors w-7 h-7"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <CardContent className="p-6 pt-16 min-h-[600px]">
                {/* Premium Voice Control - Rose Theme */}
                <motion.div
                  className={cn(
                    'flex justify-center transition-all duration-500',
                    conversationHistory.length === 0 ? 'mb-8 items-center min-h-[300px]' : 'mb-8',
                  )}
                  animate={{
                    y: conversationHistory.length === 0 ? 0 : -40,
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  <div className="relative">
                    {/* Outer glow rings for voice activity */}
                    {isListening && (
                      <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-r from-rose-500/20 to-rose-300/20 dark:from-rose-300/20 dark:to-rose-500/20 animate-pulse blur-sm" />
                    )}
                    {isSpeaking && (
                      <div className="absolute inset-0 w-36 h-36 rounded-full bg-gradient-to-r from-rose-400/30 to-rose-600/30 dark:from-rose-300/30 dark:to-rose-400/30 animate-ping blur-md" />
                    )}

                    {/* Main control button */}
                    <div
                      onClick={!isActive ? handleStart : handleEnd}
                      className={cn(
                        'relative w-28 h-28 rounded-full cursor-pointer transition-all duration-500 ease-out',
                        'bg-gradient-to-br from-background via-card to-muted dark:from-card dark:via-background dark:to-muted',
                        'shadow-md shadow-rose-500/20 dark:shadow-rose-500/20',
                        'hover:shadow-lg hover:shadow-rose-500/25 dark:hover:shadow-rose-500/25',
                        'flex items-center justify-center group',
                        isActive && 'scale-105',
                        !isActive && '',
                      )}
                    >
                      {/* Premium gradient overlays */}
                      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/15 pointer-events-none rounded-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 dark:to-white/5 pointer-events-none rounded-full" />

                      {/* Audio lines visualization */}
                      <div
                        className={cn(
                          'relative z-10 transition-all duration-300',
                          isListening && 'scale-110',
                          isSpeaking && 'scale-125',
                        )}
                      >
                        <div className="flex items-center gap-0.5">
                          <div
                            className={cn(
                              'w-0.5 bg-rose-600 dark:bg-rose-300 rounded-full transition-all duration-150',
                              isActive ? (isSpeaking ? 'h-6 animate-pulse' : 'h-2') : 'h-3',
                            )}
                          />
                          <div
                            className={cn(
                              'w-0.5 bg-rose-600 dark:bg-rose-300 rounded-full transition-all duration-150',
                              isActive ? (isSpeaking ? 'h-8 animate-pulse' : 'h-3') : 'h-5',
                            )}
                            style={{ animationDelay: '75ms' }}
                          />
                          <div
                            className={cn(
                              'w-0.5 bg-rose-600 dark:bg-rose-300 rounded-full transition-all duration-150',
                              isActive ? (isSpeaking ? 'h-4 animate-pulse' : 'h-2') : 'h-2',
                            )}
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className={cn(
                              'w-0.5 bg-rose-600 dark:bg-rose-300 rounded-full transition-all duration-150',
                              isActive ? (isSpeaking ? 'h-7 animate-pulse' : 'h-4') : 'h-6',
                            )}
                            style={{ animationDelay: '225ms' }}
                          />
                          <div
                            className={cn(
                              'w-0.5 bg-rose-600 dark:bg-rose-300 rounded-full transition-all duration-150',
                              isActive ? (isSpeaking ? 'h-5 animate-pulse' : 'h-2') : 'h-3',
                            )}
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>

                      {/* Background glow */}
                      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-full blur-xl opacity-0 dark:opacity-30 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>

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
