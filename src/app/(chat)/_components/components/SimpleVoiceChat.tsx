'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Phone, PhoneOff, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSimpleVoiceChat } from '@/hooks/useSimpleVoiceChat'
import { ModelInfo } from '@/lib/models'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings } from 'lucide-react'

interface SimpleVoiceChatProps {
  isOpen: boolean
  onClose: () => void
  onSaveConversation: (conversationHistory: Array<{role: 'user' | 'assistant', content: string}>) => Promise<void>
  onSendMessage?: (message: string, conversationHistory: Array<{role: 'user' | 'assistant', content: string}>) => Promise<string>
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
  availableModels = []
}: SimpleVoiceChatProps) {
  
  const sendMessageWithModel = onSendMessage
    ? (message: string, conversationHistory: Array<{role: 'user' | 'assistant', content: string}>) => onSendMessage(message, conversationHistory)
    : undefined

  const {
    isActive,
    isListening,
    isSpeaking,
    transcript,
    conversationHistory,
    startVoiceChat,
    endVoiceChat,
    isSupported
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
    if (!isActive) return 'Press to start voice chat'
    if (isListening) return 'Listening...'
    if (isSpeaking) return 'AI speaking...'
    return 'Processing...'
  }

  const getStatusColor = () => {
    if (!isActive) return 'text-gray-500'
    if (isListening) return 'text-green-500'
    if (isSpeaking) return 'text-purple-500'
    return 'text-blue-500'
  }

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
            <Card className="w-full max-w-md">
              <CardContent className="p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Voice Chat Not Supported</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your browser doesn't support speech recognition.
                </p>
                <Button onClick={onClose}>Close</Button>
              </CardContent>
            </Card>
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isActive) {
              onClose()
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md"
          >
            <Card className="shadow-2xl">
              <CardContent className="p-8 text-center">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-semibold">Voice Chat</h2>
                    {!isActive && onModelChange && availableModels.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-gray-500" />
                        <Select
                          value={selectedModel?.id}
                          onValueChange={(value) => {
                            const model = availableModels.find(m => m.id === value)
                            if (model) onModelChange(model)
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Model" />
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
                    )}
                  </div>
                  <p className={cn('text-sm', getStatusColor())}>
                    {getStatus()}
                  </p>
                  {selectedModel && !isActive && (
                    <p className="text-xs text-gray-500 mt-1">
                      Using {selectedModel.name}
                    </p>
                  )}
                </div>

                {/* Visual Indicator */}
                <div className="mb-8 flex justify-center">
                  <motion.div
                    className={cn(
                      'w-32 h-32 rounded-full flex items-center justify-center shadow-lg',
                      isListening 
                        ? 'bg-green-500' 
                        : isSpeaking 
                        ? 'bg-purple-500'
                        : isActive
                        ? 'bg-blue-500'
                        : 'bg-gray-400'
                    )}
                    animate={isListening ? {
                      scale: [1, 1.1, 1],
                    } : {}}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Mic className="w-12 h-12 text-white" />
                  </motion.div>
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-4 mb-6">
                  {!isActive ? (
                    <Button
                      onClick={handleStart}
                      size="lg"
                      className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Phone className="w-6 h-6" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleEnd}
                      size="lg"
                      className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </Button>
                  )}
                </div>

                {/* Conversation History */}
                {conversationHistory.length > 0 && (
                  <div className="text-left max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-500 mb-2 font-medium">Conversation:</div>
                    {conversationHistory.map((msg, idx) => (
                      <div key={idx} className="mb-3 last:mb-0">
                        <div className={cn(
                          'text-xs font-medium mb-1',
                          msg.role === 'user' ? 'text-blue-600' : 'text-purple-600'
                        )}>
                          {msg.role === 'user' ? '🎤 You' : '🤖 AI'}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Instructions */}
                {!isActive && (
                  <p className="text-xs text-gray-500 mt-4">
                    Click the green button to start, speak naturally, and click red to end.
                    Your conversation will be saved as a new chat.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 