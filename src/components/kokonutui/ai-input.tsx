'use client'

import type React from 'react'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/hooks/resize-textarea'
import { ArrowUpCircle, Paperclip, Globe, ChevronDown, Sparkles, Lightbulb, Plus, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ModelInfo, models } from '@/lib/models'
interface AIInputProps {
  value: string
  onValueChange: (value: string) => void
  onSend?: (message: string, model: string) => void
  isTyping?: boolean
  onStop?: () => void
  onAttachmentClick?: () => void
  pendingAttachments?: File[]
  onRemoveAttachment?: (index: number) => void
  messagesLength: number
  isStreaming?: boolean
  selectedModel: ModelInfo
  setSelectedModel: (model: ModelInfo) => void
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'google':
    case 'gemini':
      return 'from-blue-500 to-purple-500'
    case 'anthropic':
    case 'claude':
      return 'from-purple-500 to-pink-500'
    case 'openai':
    case 'gpt':
      return 'from-green-500 to-teal-500'
    case 'deepseek':
      return 'from-cyan-500 to-blue-500'
    case 'meta':
    case 'llama':
      return 'from-indigo-500 to-blue-500'
    case 'o-series':
      return 'from-orange-500 to-red-500'
    case 'openrouter':
      return 'from-gray-500 to-gray-600'
    default:
      return 'from-gray-500 to-gray-600'
  }
}

export default function AIInput({
  value,
  onValueChange,
  onSend,
  isStreaming,
  isTyping,
  onStop,
  onAttachmentClick,
  pendingAttachments = [],
  onRemoveAttachment,
  messagesLength,
  selectedModel,
  setSelectedModel,
}: AIInputProps) {
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [groupBy, setGroupBy] = useState<'provider' | 'category'>('provider')
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 40,
    maxHeight: 160,
  })

  const handleSend = () => {
    if (value.trim() && onSend && !isTyping) {
      onSend(value.trim(), selectedModel.id)
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

  const groupedModels = models.reduce(
    (acc, model) => {
      const groupKey = groupBy === 'provider' ? model.provider : model.category
      if (!acc[groupKey]) {
        acc[groupKey] = []
      }
      acc[groupKey].push(model)
      return acc
    },
    {} as Record<string, ModelInfo[]>,
  )

  // Sort groups and models within groups
  const sortedGroupedModels = Object.entries(groupedModels)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce(
      (acc, [groupKey, groupModels]) => {
        // Sort models within each group
        const sortedModels = groupModels.sort((a, b) => {
          if (groupBy === 'provider') {
            // When grouped by provider, sort by category first, then by name
            if (a.category !== b.category) {
              return a.category.localeCompare(b.category)
            }
          }
          return a.name.localeCompare(b.name)
        })
        acc[groupKey] = sortedModels
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
            className="w-full px-3 md:px-4 py-2 resize-none bg-transparent border-0 outline-none text-sm md:text-base min-h-[40px] leading-normal placeholder:text-black/40 dark:placeholder:text-rose-200/30 text-black dark:text-white"
            style={{
              overflow: 'hidden',
              outline: 'none',
              border: 'none',
              boxShadow: 'none',
              WebkitAppearance: 'none',
              fontFamily: 'inherit',
              height: '40px', // Match the minHeight to prevent hydration mismatch
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
                    'h-7 md:h-8 px-2.5 md:px-3 text-xs md:text-sm transition-all duration-200 rounded-md',
                    'bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40',
                    'flex items-center gap-1 md:gap-1.5',
                    'text-black/70 dark:text-white/70',
                    'hover:text-black dark:hover:text-white',
                    'hover:bg-black/5 dark:hover:bg-white/5',
                  )}
                >
                  <div className="flex items-center gap-1 md:gap-1.5">
                    <div
                      className={cn(
                        'w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-gradient-to-r',
                        getCategoryColor(selectedModel.category),
                      )}
                    ></div>
                    <span className="truncate max-w-[80px] md:max-w-[120px]">{selectedModel.name}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-3 md:w-3.5 h-3 md:h-3.5 transition-transform duration-200',
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
                      className="absolute z-50 bottom-full mb-2 left-0 bg-white dark:bg-[oklch(0.18_0.015_25)] rounded-lg border border-rose-200/50 dark:border-rose-500/20 shadow-2xl overflow-hidden w-[280px]"
                    >
                      {/* Header */}
                      <div className="p-3 border-b border-rose-200/30 dark:border-rose-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">Select Model</h3>
                          <button className="group relative p-2 rounded-xl bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 hover:border-rose-500/20 dark:hover:border-rose-300/20 transition-all duration-300 ease-out shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20 hover:shadow-xl hover:shadow-rose-500/10 dark:hover:shadow-rose-500/10">
                            {/* Gradient overlays for premium look */}
                            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-xl"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-xl"></div>

                            <div className="relative z-10 flex items-center gap-1">
                              <span className="text-xs font-medium text-rose-600 dark:text-rose-300">Pro</span>
                              <Plus className="w-3 h-3 text-rose-600 dark:text-rose-300" />
                            </div>

                            {/* Premium glow effect in dark mode */}
                            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
                          </button>
                        </div>

                        {/* Group By Toggle */}
                      </div>

                      {/* Compact Controls */}
                      <div className="px-3 py-2 border-b border-rose-200/30 dark:border-rose-500/20">
                        <div className="flex items-center justify-between gap-3">
                          {/* Thinking Mode Toggle */}
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-3.5 h-3.5 text-rose-500/70 dark:text-rose-300/70" />
                            <span className="text-xs text-rose-900 dark:text-rose-100">Thinking</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleThinkingToggle(!thinkingEnabled)
                              }}
                              className={cn(
                                'relative w-8 h-4 rounded-full transition-colors duration-200',
                                thinkingEnabled 
                                  ? 'bg-rose-500 dark:bg-rose-400' 
                                  : 'bg-rose-200 dark:bg-rose-800'
                              )}
                            >
                              <div
                                className={cn(
                                  'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200',
                                  thinkingEnabled ? 'translate-x-4' : 'translate-x-0'
                                )}
                              />
                            </button>
                          </div>

                          {/* Group By Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-rose-900 dark:text-rose-100">Group by</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setGroupBy(groupBy === 'provider' ? 'category' : 'provider')
                              }}
                              className="text-xs px-2 py-1 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors duration-200 w-16 text-center"
                            >
                              {groupBy === 'provider' ? 'Provider' : 'Category'}
                            </button>
                          </div>
                        </div>
                      </div>

                                              <div
                        className="max-h-[300px] overflow-y-auto"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(244 63 94 / 0.3) transparent' }}
                      >
                        {/* Grouped Models */}
                        {Object.entries(sortedGroupedModels).map(([groupKey, groupModels]) => (
                          <div
                            key={groupKey}
                            className="p-2 border-b border-rose-200/30 dark:border-rose-500/20 last:border-b-0"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full bg-gradient-to-r',
                                  getCategoryColor(
                                    groupBy === 'provider' ? groupModels[0]?.category || groupKey : groupKey,
                                  ),
                                )}
                              ></div>
                              <span className="text-xs font-medium text-rose-500/70 dark:text-rose-300/70 capitalize">
                                {groupKey === 'openrouter' ? 'OpenRouter' : groupKey}
                              </span>
                              <span className="text-xs text-rose-400/60 dark:text-rose-400/60">
                                ({groupModels.length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {groupModels.map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => {
                                    setSelectedModel(model)
                                    setShowModelSelect(false)
                                  }}
                                  className={cn(
                                    'group w-full p-1.5 cursor-pointer transition-all duration-150 ease-[0.25,1,0.5,1] relative overflow-hidden text-left',
                                    selectedModel.id === model.id
                                      ? 'text-rose-600 dark:text-rose-300'
                                      : 'hover:text-rose-600 dark:hover:text-rose-300 text-black/70 dark:text-white/70',
                                    !thinkingEnabled && model.supportsThinking && 'opacity-40 cursor-not-allowed',
                                  )}
                                  disabled={!thinkingEnabled && model.supportsThinking}
                                >
                                  {/* Premium background for active state */}
                                  {selectedModel.id === model.id && (
                                    <>
                                      {/* Main gradient background with sharp edges */}
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>

                                      {/* Top shadow lighting */}
                                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                                      {/* Bottom shadow lighting */}
                                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                                      {/* Premium inner glow */}
                                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
                                    </>
                                  )}

                                  {/* Hover effect for non-active items */}
                                  {selectedModel.id !== model.id && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
                                      {/* Main gradient background with sharp edges */}
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>

                                      {/* Top shadow lighting */}
                                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                                      {/* Bottom shadow lighting */}
                                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

                                      {/* Premium inner glow */}
                                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="text-sm truncate">
                                        {model.name}
                                      </span>
                                      {groupBy === 'category' && model.provider === 'openrouter' && (
                                        <span className="text-xs text-rose-500/60 dark:text-rose-300/60 bg-rose-100/50 dark:bg-rose-900/30 px-2 py-0.5 rounded-full">
                                          OpenRouter
                                        </span>
                                      )}
                                    </div>

                                    {model.supportsThinking && (
                                      <div className="flex-shrink-0 relative">
                                        <Lightbulb
                                          className={cn(
                                            'w-3.5 h-3.5',
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
                className="p-2 md:p-2.5 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5"
              >
                <Paperclip className="w-3.5 md:w-4 h-3.5 md:h-4" />
              </button>
              <button
                type="button"
                className="p-2 md:p-2.5 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5"
              >
                <Globe className="w-3.5 md:w-4 h-3.5 md:h-4" />
              </button>
            </div>
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation (Esc)"
                className="p-2 md:p-2.5 transition-all duration-300 rounded-full text-rose-500 dark:text-rose-300 hover:shadow-md hover:shadow-rose-500/20 dark:hover:shadow-rose-500/20 scale-100"
              >
                <Square className="w-5 md:w-6 h-5 md:h-6 transition-transform duration-300 animate-pulse" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={(!value.trim() && pendingAttachments.length === 0) || isStreaming}
                className={cn(
                  'p-2 md:p-2.5 transition-all duration-300 rounded-full',
                  (value.trim() || pendingAttachments.length > 0) && !isTyping
                    ? 'text-rose-500 dark:text-rose-300 hover:shadow-md hover:shadow-rose-500/20 dark:hover:shadow-rose-500/20 scale-100'
                    : 'text-black/30 dark:text-rose-300/30 scale-95',
                )}
              >
                <ArrowUpCircle
                  className={cn(
                    'w-5 md:w-6 h-5 md:h-6 transition-transform duration-300',
                    (value.trim() || pendingAttachments.length > 0) && !isStreaming && 'hover:translate-y-[-2px]',
                  )}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Premium subtle glow effect in dark mode */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-t-2xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
    </div>
  )
}
