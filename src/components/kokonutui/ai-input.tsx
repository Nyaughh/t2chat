'use client'

import type React from 'react'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/hooks/resize-textarea'
import { ArrowUpCircle, Paperclip, Globe, ChevronDown, Sparkles, Lightbulb, Plus, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface AIInputProps {
  value: string
  onValueChange: (value: string) => void
  onSend?: (message: string) => void
  isTyping?: boolean
  onStop?: () => void
  onAttachmentClick?: () => void
  pendingAttachments?: File[]
  onRemoveAttachment?: (index: number) => void,
  messagesLength: number
}

interface ModelInfo {
  id: string
  name: string
  description: string
  category: 'favorites' | 'others'
  provider: 'gemini' | 'gpt' | 'claude' | 'o-series' | 'llama'
  features: ('vision' | 'web' | 'code')[]
  isPro: boolean
  isNew?: boolean
  supportsThinking?: boolean
}

const models: ModelInfo[] = [
  // Favorites
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Latest and fastest model',
    category: 'favorites',
    provider: 'gemini',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: true,
  },

  // Others - Gemini Family
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Lightweight version for quick tasks',
    category: 'others',
    provider: 'gemini',
    features: ['vision', 'code'],
    isPro: false,
    isNew: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Advanced reasoning capabilities',
    category: 'others',
    provider: 'gemini',
    features: ['vision', 'web', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Most capable model for complex tasks',
    category: 'others',
    provider: 'gemini',
    features: ['vision', 'web', 'code'],
    isPro: true,
    supportsThinking: true,
  },

  // GPT Models
  {
    id: 'gpt-imagegen',
    name: 'GPT ImageGen',
    description: 'Specialized for image generation',
    category: 'others',
    provider: 'gpt',
    features: ['vision'],
    isPro: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT 4o-mini',
    description: 'Compact and efficient',
    category: 'others',
    provider: 'gpt',
    features: ['vision'],
    isPro: false,
  },
  {
    id: 'gpt-4o',
    name: 'GPT 4o',
    description: 'Omni-modal capabilities',
    category: 'others',
    provider: 'gpt',
    features: ['vision'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT 4.1',
    description: 'Enhanced reasoning model',
    category: 'others',
    provider: 'gpt',
    features: ['vision'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT 4.1 Mini',
    description: 'Lightweight reasoning model',
    category: 'others',
    provider: 'gpt',
    features: ['vision'],
    isPro: false,
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT 4.1 Nano',
    description: 'Ultra-fast responses',
    category: 'others',
    provider: 'gpt',
    features: ['vision'],
    isPro: false,
  },

  // O-Series Models
  {
    id: 'o3-mini',
    name: 'o3 mini',
    description: 'Advanced reasoning in compact form',
    category: 'others',
    provider: 'o-series',
    features: ['web', 'code'],
    isPro: false,
  },
  {
    id: 'o4-mini',
    name: 'o4 mini',
    description: 'Next-gen reasoning model',
    category: 'others',
    provider: 'o-series',
    features: ['vision', 'web'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'o3',
    name: 'o3',
    description: 'Powerful reasoning capabilities',
    category: 'others',
    provider: 'o-series',
    features: ['vision', 'web'],
    isPro: false,
    supportsThinking: true,
  },

  // Claude Models
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Balanced performance and speed',
    category: 'others',
    provider: 'claude',
    features: ['vision', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    description: 'Enhanced writing and analysis',
    category: 'others',
    provider: 'claude',
    features: ['vision', 'code'],
    isPro: false,
    supportsThinking: true,
  },
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet',
    description: 'Latest Claude capabilities',
    category: 'others',
    provider: 'claude',
    features: ['vision', 'code'],
    isPro: true,
    supportsThinking: true,
  },
  {
    id: 'claude-4-opus',
    name: 'Claude 4 Opus',
    description: 'Most capable Claude model',
    category: 'others',
    provider: 'claude',
    features: ['vision', 'code'],
    isPro: true,
    supportsThinking: true,
  },

  // Llama
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70b',
    description: 'Open-source excellence',
    category: 'others',
    provider: 'llama',
    features: ['code'],
    isPro: false,
    isNew: true,
    supportsThinking: true,
  },
]

const getProviderColor = (provider: string) => {
  switch (provider) {
    case 'gemini':
      return 'from-blue-500 to-purple-500'
    case 'gpt':
      return 'from-green-500 to-teal-500'
    case 'claude':
      return 'from-purple-500 to-pink-500'
    case 'o-series':
      return 'from-orange-500 to-red-500'
    case 'llama':
      return 'from-indigo-500 to-blue-500'
    default:
      return 'from-gray-500 to-gray-600'
  }
}

export default function AIInput({
  value,
  onValueChange,
  onSend,
  isTyping,
  onStop,
  onAttachmentClick,
  pendingAttachments = [],
  onRemoveAttachment,
  messagesLength,
}: AIInputProps) {
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(models[0])
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 80,
    maxHeight: 200,
  })

  const handleSend = () => {
    if (value.trim() && onSend && !isTyping) {
      onSend(value.trim())
      if (messagesLength === 0) {
        setTimeout(() => {
          onValueChange('')
          adjustHeight(true)
        }, 750)
      } else {
        onValueChange('')
        adjustHeight(true)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // When thinking mode is toggled, ensure selected model is compatible
  const handleThinkingToggle = (enabled: boolean) => {
    setThinkingEnabled(enabled)

    // If disabling thinking mode and current model requires thinking,
    // switch to a model that doesn't require thinking
    if (!enabled && selectedModel.supportsThinking) {
      // Find the first model that doesn't require thinking
      const nonThinkingModel = models.find((m) => !m.supportsThinking)
      if (nonThinkingModel) {
        setSelectedModel(nonThinkingModel)
      }
    }
  }

  const favoriteModels = models.filter((model) => model.category === 'favorites')
  const otherModels = models.filter((model) => model.category === 'others')

  // Group other models by provider
  const groupedModels = otherModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    },
    {} as Record<string, ModelInfo[]>,
  )

  return (
    <div className="relative">
      <div className="relative flex flex-col bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border-t border-x border-rose-500/10 dark:border-white/10 overflow-visible rounded-t-2xl shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20">
        {/* Subtle gradient overlay for premium look */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-t-2xl"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-t-2xl"></div>

        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <div className="relative z-10 p-4 pb-2 border-b border-black/10 dark:border-white/10">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-rose-500/5 dark:bg-rose-300/5 border border-rose-500/20 dark:border-rose-300/20 rounded-lg px-3 py-2 group"
                >
                  <Paperclip className="w-4 h-4 text-rose-500/70 dark:text-rose-300/70" />
                  <span className="text-base text-black dark:text-white truncate max-w-40">{file.name}</span>
                  <button
                    onClick={() => onRemoveAttachment?.(index)}
                    className="text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-y-auto relative z-10">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onValueChange(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isTyping}
            className="w-full px-4 md:px-5 py-4 resize-none bg-transparent border-0 outline-none text-base md:text-lg min-h-[70px] md:min-h-[80px] leading-relaxed placeholder:text-black/40 dark:placeholder:text-rose-200/30 text-black dark:text-white"
            style={{
              overflow: 'hidden',
              outline: 'none',
              border: 'none',
              boxShadow: 'none',
              WebkitAppearance: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div className="h-14 md:h-16">
          <div className="absolute left-3 md:left-4 right-3 md:right-4 bottom-3 md:bottom-4 flex items-center justify-between">
            <div className="flex items-center gap-1 md:gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelSelect(!showModelSelect)}
                  className={cn(
                    'h-8 md:h-10 px-3 md:px-4 text-sm md:text-base transition-all duration-200 rounded-lg',
                    'bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40',
                    'flex items-center gap-1.5 md:gap-2',
                    'text-black/70 dark:text-white/70',
                    'hover:text-black dark:hover:text-white',
                    'hover:bg-black/5 dark:hover:bg-white/5',
                  )}
                >
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div
                      className={cn(
                        'w-2.5 md:w-3 h-2.5 md:h-3 rounded-full bg-gradient-to-r',
                        getProviderColor(selectedModel.provider),
                      )}
                    ></div>
                    <span className="truncate max-w-[100px] md:max-w-none">{selectedModel.name}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-3.5 md:w-4 h-3.5 md:h-4 transition-transform duration-200',
                      showModelSelect && 'transform rotate-180',
                    )}
                  />
                </button>

                <AnimatePresence>
                  {showModelSelect && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="absolute z-50 bottom-full mb-2 left-0 bg-white dark:bg-[oklch(0.18_0.015_25)] rounded-lg border border-rose-200/50 dark:border-rose-500/20 shadow-2xl overflow-hidden w-[320px] max-h-[500px]"
                    >
                      {/* Header */}
                      <div className="p-4 border-b border-rose-200/30 dark:border-rose-500/20">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-rose-900 dark:text-rose-100">Select Model</h3>
                          <button className="group relative p-2 rounded-xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 ease-out shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20 hover:shadow-xl hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10">
                            {/* Gradient overlays for premium look */}
                            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-xl"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-xl"></div>

                            <div className="relative z-10 flex items-center gap-1.5">
                              <span className="text-sm font-medium text-rose-600 dark:text-rose-300">Pro</span>
                              <Plus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />
                            </div>

                            {/* Premium glow effect in dark mode */}
                            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
                          </button>
                        </div>
                      </div>

                      {/* Thinking Mode Toggle */}
                      <div className="p-3 border-b border-rose-200/30 dark:border-rose-500/20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleThinkingToggle(!thinkingEnabled)
                          }}
                          className={cn(
                            'group w-full relative overflow-hidden bg-gradient-to-br from-rose-500/12 via-rose-500/8 to-rose-500/12 dark:from-rose-300/12 dark:via-rose-300/8 dark:to-rose-300/12 text-rose-600 dark:text-rose-300 h-12 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 dark:shadow-rose-500/10 dark:hover:shadow-rose-500/20 transition-all duration-300 ease-out backdrop-blur-sm',
                            !thinkingEnabled && 'opacity-50',
                          )}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent dark:from-white/10 rounded-xl"></div>
                          <div className="relative z-10 flex items-center justify-center gap-2">
                            <Lightbulb className="w-5 h-5" />
                            <span className="tracking-[0.5px] transition-all duration-300 ease-out">Thinking Mode</span>
                            <div
                              className={cn(
                                'text-sm px-2 py-0.5 rounded-full transition-colors ml-1',
                                thinkingEnabled
                                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                  : 'bg-rose-500/10 text-rose-600/60 dark:text-rose-300/60',
                              )}
                            >
                              {thinkingEnabled ? 'On' : 'Off'}
                            </div>
                          </div>
                        </button>
                      </div>

                      <div className="max-h-[340px] md:max-h-[440px] overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {/* Grouped by Provider */}
                        {Object.entries(groupedModels).map(([provider, providerModels]) => (
                          <div
                            key={provider}
                            className="p-3 border-b border-rose-200/30 dark:border-rose-500/20 last:border-b-0"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={cn('w-3 h-3 rounded-full bg-gradient-to-r', getProviderColor(provider))}
                              ></div>
                              <span className="text-sm font-medium text-rose-500/70 dark:text-rose-300/70 capitalize">
                                {provider}
                              </span>
                              <span className="text-xs text-rose-400/60 dark:text-rose-400/60">
                                ({providerModels.length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {providerModels.map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => {
                                    setSelectedModel(model)
                                    setShowModelSelect(false)
                                  }}
                                  className={cn(
                                    'w-full p-2 rounded-md transition-all duration-200 text-left border',
                                    'hover:bg-rose-100/50 dark:hover:bg-rose-900/20',
                                    selectedModel.id === model.id
                                      ? 'bg-rose-100/50 dark:bg-rose-900/30 border-rose-500/50'
                                      : 'border-transparent',
                                    !thinkingEnabled && model.supportsThinking && 'opacity-40 cursor-not-allowed',
                                  )}
                                  disabled={!thinkingEnabled && model.supportsThinking}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-base text-rose-900 dark:text-rose-100 truncate">
                                        {model.name}
                                      </span>
                                    </div>

                                    {model.supportsThinking && (
                                      <div className="flex-shrink-0 relative">
                                        <Lightbulb
                                          className={cn(
                                            'w-4 h-4',
                                            thinkingEnabled && selectedModel.id === model.id
                                              ? 'text-rose-500'
                                              : 'text-rose-400/60 dark:text-rose-500/60',
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={onAttachmentClick}
                className="p-2 md:p-3 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5"
              >
                <Paperclip className="w-4 md:w-5 h-4 md:h-5" />
              </button>
              <button
                type="button"
                className="p-2 md:p-3 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5"
              >
                <Globe className="w-4 md:w-5 h-4 md:h-5" />
              </button>
            </div>
            <AnimatePresence>
              <div className="flex-shrink-0 self-end">
                <motion.button
                  key={isTyping ? 'stop' : 'send'}
                  onClick={isTyping ? onStop : handleSend}
                  disabled={isTyping ? false : !value.trim()}
                  className={cn(
                    'group rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-rose-100 dark:focus-visible:ring-offset-rose-900',
                    isTyping
                      ? 'w-8 h-8 md:w-10 md:h-10 bg-rose-500/20 hover:bg-rose-500/30 dark:bg-rose-300/20 dark:hover:bg-rose-300/30 text-rose-600 dark:text-rose-300 focus-visible:ring-rose-500'
                      : value.trim()
                        ? 'w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-300 dark:to-rose-400 text-white shadow-lg hover:shadow-xl shadow-rose-500/20 dark:shadow-rose-500/10 transition-all duration-300 ease-out'
                        : 'w-8 h-8 md:w-10 md:h-10 bg-black/5 dark:bg-white/10 text-black/30 dark:text-white/30 cursor-not-allowed',
                  )}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: 'circOut' }}
                >
                  {isTyping ? (
                    <Square className="w-4 md:w-5 h-4 md:h-5 mx-auto" />
                  ) : (
                    <ArrowUpCircle className="w-5 md:w-6 h-5 md:w-6 mx-auto group-hover:scale-110 transition-transform" />
                  )}
                </motion.button>
              </div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Premium subtle glow effect in dark mode */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-t-2xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
    </div>
  )
}
