'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Settings,
  Pause,
  Play,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useVoiceChat } from '@/hooks/useVoiceChat'

interface VoiceChatInterfaceProps {
  isOpen: boolean
  onClose: () => void
  onMessageSend: (message: string) => void
  onResponse: (response: string) => void
  lastAIResponse?: string
  className?: string
}

export function VoiceChatInterface({
  isOpen,
  onClose,
  onMessageSend,
  onResponse,
  lastAIResponse,
  className,
}: VoiceChatInterfaceProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)

  const {
    isActive,
    isListening,
    isSpeaking,
    isProcessing,
    currentTranscript,
    interimTranscript,
    error,
    voices,
    selectedVoice,
    setVoice,
    startVoiceChat,
    stopVoiceChat,
    speakResponse,
    sendCurrentTranscript,
    clearTranscript,
    isSupported,
  } = useVoiceChat(onMessageSend, onResponse, {
    autoSpeak: !isMuted,
    continuousMode: true,
    silenceDetectionTime: 2000,
  })

  // Speak AI responses when they come in
  useEffect(() => {
    if (lastAIResponse && isActive && !isMuted) {
      speakResponse(lastAIResponse)
    }
  }, [lastAIResponse, isActive, isMuted, speakResponse])

  const handleToggleCall = () => {
    if (isActive) {
      stopVoiceChat()
    } else {
      startVoiceChat()
    }
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
    if (isSpeaking) {
      window.speechSynthesis.cancel()
    }
  }

  const getStatusText = () => {
    if (!isActive) return 'Tap to start voice chat'
    if (isProcessing) return 'Processing...'
    if (isSpeaking) return 'AI is speaking...'
    if (isListening) return 'Listening...'
    return 'Voice chat active'
  }

  const getStatusColor = () => {
    if (!isActive) return 'text-gray-500 dark:text-gray-400'
    if (isProcessing) return 'text-blue-500 dark:text-blue-400'
    if (isSpeaking) return 'text-white'
    if (isListening) return 'text-white'
    return 'text-rose-500 dark:text-rose-400'
  }

  if (!isSupported) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-auto z-50',
              className,
            )}
          >
            <Card className="h-full shadow-2xl border-red-200 dark:border-red-800">
              <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                <MicOff className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Voice Chat Not Supported</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Your browser doesn't support speech recognition. Please try Chrome, Edge, or Safari.
                </p>
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
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
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Voice Chat Interface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-auto z-50',
              className,
            )}
          >
            <Card className="h-full md:h-auto shadow-2xl border-rose-200 dark:border-rose-800 bg-gradient-to-br from-white to-rose-50/50 dark:from-gray-900 dark:to-rose-950/50">
              <CardContent className="p-6 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-lg">Voice Chat</h2>
                      <p className={cn('text-sm', getStatusColor())}>{getStatusText()}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </Button>
                </div>

                {/* Status Indicators */}
                <div className="flex justify-center gap-4 mb-6">
                  <Badge variant={isListening ? 'default' : 'secondary'} className="flex items-center gap-1">
                    <div
                      className={cn('w-2 h-2 rounded-full', isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400')}
                    />
                    Listening
                  </Badge>
                  <Badge variant={isSpeaking ? 'default' : 'secondary'} className="flex items-center gap-1">
                    <div
                      className={cn('w-2 h-2 rounded-full', isSpeaking ? 'bg-purple-500 animate-pulse' : 'bg-gray-400')}
                    />
                    Speaking
                  </Badge>
                  <Badge variant={isProcessing ? 'default' : 'secondary'} className="flex items-center gap-1">
                    <div
                      className={cn('w-2 h-2 rounded-full', isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-gray-400')}
                    />
                    Processing
                  </Badge>
                </div>

                {/* Visual Indicator */}
                <div className="flex-1 flex items-center justify-center mb-6">
                  <div className="relative">
                    {/* Outer ripple effect */}
                    <motion.div
                      className={cn(
                        'absolute inset-0 rounded-full border-2',
                        isListening
                          ? 'border-green-500/30'
                          : isSpeaking
                            ? 'border-purple-500/30'
                            : isProcessing
                              ? 'border-blue-500/30'
                              : 'border-gray-300/30',
                      )}
                      animate={
                        isActive
                          ? {
                              scale: [1, 1.2, 1],
                              opacity: [0.6, 0.3, 0.6],
                            }
                          : {}
                      }
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />

                    {/* Main circle */}
                    <motion.div
                      className={cn(
                        'w-32 h-32 rounded-full flex items-center justify-center shadow-xl',
                        isListening
                          ? 'bg-gradient-to-br from-green-400 to-green-600'
                          : isSpeaking
                            ? 'bg-gradient-to-br from-purple-400 to-purple-600'
                            : isProcessing
                              ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                              : isActive
                                ? 'bg-gradient-to-br from-rose-400 to-rose-600'
                                : 'bg-gradient-to-br from-gray-400 to-gray-600',
                      )}
                      animate={
                        isActive
                          ? {
                              scale: isListening ? [1, 1.05, 1] : [1],
                            }
                          : {}
                      }
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-12 h-12 text-white animate-spin" />
                      ) : (
                        <Mic className="w-12 h-12 text-white" />
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Transcript Display */}
                {showTranscript && (currentTranscript || interimTranscript) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto"
                  >
                    <div className="text-sm">
                      {currentTranscript && (
                        <span className="text-gray-900 dark:text-gray-100">{currentTranscript}</span>
                      )}
                      {interimTranscript && (
                        <span className="text-gray-500 dark:text-gray-400 italic">{interimTranscript}</span>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Error Display */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4"
                  >
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </motion.div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Main Call Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleToggleCall}
                        size="lg"
                        className={cn(
                          'w-14 h-14 rounded-full shadow-lg transition-all duration-300',
                          isActive
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white',
                        )}
                      >
                        {isActive ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isActive ? 'End voice chat' : 'Start voice chat'}</TooltipContent>
                  </Tooltip>

                  {/* Mute Button */}
                  {isActive && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleMuteToggle}
                          variant="outline"
                          size="lg"
                          className="w-12 h-12 rounded-full"
                        >
                          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isMuted ? 'Unmute AI voice' : 'Mute AI voice'}</TooltipContent>
                    </Tooltip>
                  )}

                  {/* Send Transcript Button */}
                  {isActive && currentTranscript && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={sendCurrentTranscript}
                          variant="outline"
                          size="lg"
                          className="w-12 h-12 rounded-full"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Send current transcript</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Additional Controls */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center justify-center gap-2 mt-4"
                  >
                    <Button
                      onClick={() => setShowTranscript(!showTranscript)}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                    >
                      {showTranscript ? 'Hide' : 'Show'} Transcript
                    </Button>
                    {currentTranscript && (
                      <Button onClick={clearTranscript} variant="ghost" size="sm" className="text-xs">
                        Clear
                      </Button>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
