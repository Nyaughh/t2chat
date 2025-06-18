'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Phone, PhoneOff, MessageSquare, User, Settings2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSimpleVoiceChat } from '@/hooks/useSimpleVoiceChat'
import { ModelInfo } from '@/lib/models'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Badge } from '@/components/ui/badge'

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

  const handleStart = () => {
    startVoiceChat()
  }

  const handleEnd = async () => {
    endVoiceChat()
    if (conversationHistory.length > 0) {
      await onSaveConversation(conversationHistory)
    }
    onClose()
  }

  const getStatus = () => {
    if (!isActive) return 'Ready to start voice conversation'
    if (isListening) return 'Listening to your voice...'
    if (isSpeaking) return 'AI is speaking...'
    return 'Processing your request...'
  }

  const getStatusColor = () => {
    if (!isActive) return 'text-gray-500 dark:text-gray-400'
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
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <Card className="border-rose-200/50 dark:border-rose-500/20 shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Mic className="w-8 h-8 text-red-500 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Voice Chat Not Supported
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Your browser doesn't support speech recognition. Please try using Chrome, Edge, or Safari for the
                    best voice chat experience.
                  </p>
                  <Button onClick={onClose} className="w-full">
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isActive) {
              onClose()
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-lg"
          >
            <Card className="border-rose-200/50 dark:border-rose-500/20 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
              <CardContent className="p-8">
                {/* Header with Context */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Voice Chat</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Natural conversation with AI</p>
                      </div>
                    </div>
                    {!isActive && onModelChange && availableModels.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-gray-400" />
                        <Select
                          value={selectedModel?.id}
                          onValueChange={(value) => {
                            const model = availableModels.find((m) => m.id === value)
                            if (model) onModelChange(model)
                          }}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs border-gray-200 dark:border-gray-700">
                            <SelectValue placeholder="Model" />
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
                  </div>

                  {/* User Context Display */}
                  {/* {userSettings && getUserContext() && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200/50 dark:border-blue-700/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">AI knows your context</span>
                        {hasCustomPrompt && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Custom Prompt
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        {getUserContext()?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                            {item}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        ✓ This context will be shared with the AI during your conversation
                      </div>
                    </motion.div>
                  )} */}

                  {/* Status */}
                  <div className="text-center">
                    <motion.p
                      className={cn('text-sm font-medium', getStatusColor())}
                      animate={{ opacity: isListening ? [1, 0.7, 1] : 1 }}
                      transition={{ duration: 1.5, repeat: isListening ? Infinity : 0 }}
                    >
                      {getStatus()}
                    </motion.p>
                    {selectedModel && !isActive && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Using {selectedModel.name}</p>
                    )}
                  </div>
                </div>

                {/* Visual Indicator */}
                <div className="mb-8 flex justify-center">
                  <motion.div
                    className={cn(
                      'relative w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500',
                      isListening
                        ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30'
                        : isSpeaking
                          ? 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30'
                          : isActive
                            ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30'
                            : 'bg-gradient-to-br from-gray-400 to-gray-600 shadow-gray-500/20',
                    )}
                    animate={
                      isListening
                        ? {
                            scale: [1, 1.05, 1],
                            rotate: [0, 2, -2, 0],
                          }
                        : isSpeaking
                          ? {
                              scale: [1, 1.02, 1],
                            }
                          : {}
                    }
                    transition={{
                      duration: isListening ? 2 : 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    {/* Outer Ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-white/30"
                      animate={
                        isActive
                          ? {
                              scale: [1, 1.1, 1],
                              opacity: [0.3, 0.6, 0.3],
                            }
                          : {}
                      }
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />

                    {/* Inner Ring */}
                    <motion.div
                      className="absolute inset-4 rounded-full border-2 border-white/50"
                      animate={
                        isActive
                          ? {
                              scale: [1, 1.05, 1],
                              opacity: [0.5, 0.8, 0.5],
                            }
                          : {}
                      }
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 0.5,
                      }}
                    />

                    <Mic className="w-16 h-16 text-white drop-shadow-lg" />

                    {/* Pulse Effect for Listening */}
                    {isListening && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-white/20"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0, 0.4, 0],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-6 mb-8">
                  {!isActive ? (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={handleStart}
                        size="lg"
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30 border-0 transition-all duration-300"
                      >
                        <Phone className="w-8 h-8" />
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={handleEnd}
                        size="lg"
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30 border-0 transition-all duration-300"
                      >
                        <PhoneOff className="w-8 h-8" />
                      </Button>
                    </motion.div>
                  )}
                </div>

                {/* Conversation History */}
                <AnimatePresence>
                  {conversationHistory.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="max-h-48 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        Conversation ({conversationHistory.length} messages)
                      </div>
                      <div className="space-y-3">
                        {conversationHistory.map((msg, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                              'p-3 rounded-lg max-w-[85%] shadow-sm',
                              msg.role === 'user'
                                ? 'ml-auto bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600',
                            )}
                          >
                            <div
                              className={cn(
                                'text-xs font-medium mb-1 flex items-center gap-1',
                                msg.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400',
                              )}
                            >
                              {msg.role === 'user' ? '🎤 You' : '🤖 AI'}
                              <div
                                className={cn(
                                  'w-1 h-1 rounded-full',
                                  msg.role === 'user' ? 'bg-blue-200' : 'bg-gray-400',
                                )}
                              />
                            </div>
                            <div className="text-sm leading-relaxed">{msg.content}</div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Instructions */}
                {!isActive && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Click the green button to start your voice conversation. Speak naturally and the AI will respond.
                      Your conversation will be automatically saved as a new chat when you end the session.
                    </p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
