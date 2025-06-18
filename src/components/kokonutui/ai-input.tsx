'use client'

import type React from 'react'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/hooks/resize-textarea'
import { ArrowUpCircle, Paperclip, Globe, ChevronDown, Sparkles, Lightbulb, Plus, Square, X, FileText, Image, Upload, ArrowRight, Mic } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ModelInfo, models } from '@/lib/models'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Attachment {
  name: string
  type: string
  size: number
  url: string
}

interface AIInputProps {
  value: string
  onValueChange: (value: string) => void
  onSend?: (message: string, model: string, options: { webSearch?: boolean }) => void
  isTyping?: boolean
  onStop?: () => void
  messagesLength: number
  isStreaming?: boolean
  selectedModel: ModelInfo
  setSelectedModel: (model: ModelInfo) => void
  isSignedIn: boolean
  uploadButton?: React.ReactNode
  attachments?: Attachment[]
  onRemoveAttachment?: (index: number) => void
  uploadProgress?: { [key: string]: number }
  isUploading?: boolean
  mounted?: boolean
  sendBehavior?: 'enter' | 'shiftEnter' | 'button'
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
  messagesLength,
  selectedModel,
  setSelectedModel,
  isSignedIn,
  uploadButton,
  attachments = [],
  onRemoveAttachment,
  uploadProgress = {},
  isUploading = false,
  mounted = true,
  sendBehavior = 'enter',
}: AIInputProps) {
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [groupBy, setGroupBy] = useState<'provider' | 'category'>('provider')
  const [isDragOver, setIsDragOver] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 40,
    maxHeight: 160,
  })
  const uploadButtonRef = useRef<HTMLDivElement>(null)

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const originalTextRef = useRef('');

  const apiKeys = useQuery(api.api_keys.getApiKeys) || []

  // Speech Recognition setup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final_transcript = '';
      let interim_transcript = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        } else {
          interim_transcript += event.results[i][0].transcript;
        }
      }
      
      onValueChange(originalTextRef.current + final_transcript + interim_transcript);
      adjustHeight();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onValueChange, adjustHeight]);

  const handleToggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      originalTextRef.current = value ? value + ' ' : '';
      recognitionRef.current?.start();
    }
    setIsListening(!isListening);
  };

  const availableModels = models
  const supportsAttachments = selectedModel.attachmentsSuppport.image || selectedModel.attachmentsSuppport.pdf
  const maxFiles = 2

  // Load UI preferences from localStorage
  useEffect(() => {
    const savedThinkingEnabled = localStorage.getItem('thinkingEnabled')
    if (savedThinkingEnabled !== null) {
      setThinkingEnabled(savedThinkingEnabled === 'true')
    }
    
    const savedWebSearchEnabled = localStorage.getItem('webSearchEnabled')
    if (savedWebSearchEnabled !== null) {
      setWebSearchEnabled(savedWebSearchEnabled === 'true')
    }
    
    const savedGroupBy = localStorage.getItem('groupBy')
    if (savedGroupBy === 'provider' || savedGroupBy === 'category') {
      setGroupBy(savedGroupBy)
    }
  }, [])

  // Save thinking mode preference
  useEffect(() => {
    localStorage.setItem('thinkingEnabled', thinkingEnabled.toString())
  }, [thinkingEnabled])

  // Save web search preference
  useEffect(() => {
    localStorage.setItem('webSearchEnabled', webSearchEnabled.toString())
  }, [webSearchEnabled])

  // Save groupBy preference
  useEffect(() => {
    localStorage.setItem('groupBy', groupBy)
  }, [groupBy])

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (supportsAttachments && attachments.length < maxFiles) {
      setIsDragOver(true)
    }
  }, [supportsAttachments, attachments.length, maxFiles])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (!supportsAttachments || attachments.length >= maxFiles) return

    const files = Array.from(e.dataTransfer.files)
    const remainingSlots = maxFiles - attachments.length
    const filesToAdd = files.slice(0, remainingSlots)

    // Filter files based on model support
    const supportedFiles = filesToAdd.filter(file => {
      const isImage = selectedModel.attachmentsSuppport.image && file.type.startsWith('image/')
      const isPdf = selectedModel.attachmentsSuppport.pdf && file.type === 'application/pdf'
      return isImage || isPdf
    })

    // Try to trigger the upload button
    if (uploadButtonRef.current && supportedFiles.length > 0) {
      const button = uploadButtonRef.current.querySelector('input[type="file"]')
      
      if (button) {
        const dt = new DataTransfer()
        supportedFiles.forEach(file => dt.items.add(file))
        ;(button as HTMLInputElement).files = dt.files
        button.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  }, [supportsAttachments, attachments.length, maxFiles, selectedModel])

  const handleSend = () => {
    if (value.trim() && onSend && !isTyping) {
      onSend(value.trim(), selectedModel.id, { webSearch: webSearchEnabled })
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
    if (sendBehavior === 'enter' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (sendBehavior === 'shiftEnter' && e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // For 'button', no keyboard shortcut for sending
  }

  // When thinking mode is toggled, ensure selected model is compatible
  const handleThinkingToggle = (enabled: boolean) => {
    setThinkingEnabled(enabled)

    // If disabling thinking mode and current model requires thinking,
    // switch to a model that doesn't require thinking
    if (!enabled && selectedModel.supportsThinking) {
      // Find the first model that doesn't require thinking
      const nonThinkingModel = models.find((m) => !m.supportsThinking && (isSignedIn || m.isFree))
      if (nonThinkingModel) {
        setSelectedModel(nonThinkingModel)
      }
    }
  }

  const groupedModels = availableModels.reduce(
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
      <div 
        className={cn(
          "relative flex flex-col bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 overflow-visible rounded-2xl shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20 transition-all duration-200",
          isDragOver && "border-rose-500/30 dark:border-rose-300/30 bg-rose-500/5 dark:bg-rose-300/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-rose-500/10 dark:bg-rose-300/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-rose-500/50 dark:border-rose-300/50">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-rose-500 dark:text-rose-300" />
              <p className="text-sm font-medium text-rose-600 dark:text-rose-300">
                Drop files here ({maxFiles - attachments.length} remaining)
              </p>
            </div>
          </div>
        )}

        {/* Subtle gradient overlay for premium look */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-2xl"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-2xl"></div>

        {/* Attachments Display */}
        {(attachments.length > 0 || isUploading) && (
          <div className="relative z-10 px-3 md:px-4 pt-3 border-b border-rose-500/10 dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-300">
                Attachments ({attachments.length}/{maxFiles})
                {isUploading && (
                  <span className="ml-2 text-rose-500/70 dark:text-rose-300/70">
                    Uploading...
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pb-2">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 rounded-lg px-3 py-2 text-sm border border-rose-500/10 dark:border-white/10"
                >
                  {attachment.type.startsWith('image/') ? (
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-rose-500/70 dark:text-rose-300/70" />
                      {attachment.url && (
                        <img 
                          src={attachment.url} 
                          alt={attachment.name}
                          className="w-8 h-8 object-cover rounded border border-rose-500/20 dark:border-white/20"
                        />
                      )}
                    </div>
                  ) : (
                    <FileText className="w-4 h-4 text-rose-500/70 dark:text-rose-300/70" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-black/70 dark:text-white/70 truncate max-w-[120px] text-xs font-medium">
                      {attachment.name}
                    </span>
                    <span className="text-black/40 dark:text-white/40 text-xs">
                      {(attachment.size / 1024).toFixed(1)}KB
                    </span>
                  </div>
                  {onRemoveAttachment && (
                    <button
                      onClick={() => onRemoveAttachment(index)}
                      className="p-1 text-rose-500/60 hover:text-rose-600 dark:text-rose-300/60 dark:hover:text-rose-300 hover:bg-rose-500/10 dark:hover:bg-rose-300/10 rounded transition-all duration-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              
              {/* Upload Progress Items */}
              {Object.entries(uploadProgress).map(([fileName, progress]) => (
                <div
                  key={`uploading-${fileName}`}
                  className="flex items-center gap-2 bg-rose-500/5 dark:bg-rose-300/5 rounded-lg px-3 py-2 text-sm border border-rose-500/20 dark:border-rose-300/20"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {fileName.toLowerCase().includes('.pdf') ? (
                        <FileText className="w-4 h-4 text-rose-500/70 dark:text-rose-300/70" />
                      ) : (
                        <Image className="w-4 h-4 text-rose-500/70 dark:text-rose-300/70" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-rose-600 dark:text-rose-300 truncate max-w-[120px] text-xs font-medium">
                      {fileName}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-rose-200/50 dark:bg-rose-800/30 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-rose-500 dark:bg-rose-400 transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-rose-500/70 dark:text-rose-300/70 text-xs">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
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
                        getCategoryColor(mounted ? selectedModel.category : models[0].category),
                      )}
                    ></div>
                    <span className="truncate max-w-[80px] md:max-w-[120px]">
                      {mounted ? selectedModel.name : models[0].name}
                    </span>
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
                                    (!thinkingEnabled && model.supportsThinking) && 'opacity-40 cursor-not-allowed',
                                    !isSignedIn && !model.isFree && 'opacity-40 cursor-not-allowed',
                                    model.isPro && !apiKeys.some(k => k.service === model.provider) && 'opacity-40 cursor-not-allowed',
                                  )}
                                  disabled={
                                    (!thinkingEnabled && model.supportsThinking) || 
                                    (!isSignedIn && !model.isFree) ||
                                    (model.isPro && !apiKeys.some(k => k.service === model.provider))
                                  }
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
              {isSignedIn && (selectedModel.attachmentsSuppport.image || selectedModel.attachmentsSuppport.pdf) && (
                <div ref={uploadButtonRef}>
                  {uploadButton}
                </div>
              )}
              {isSignedIn && selectedModel.features.includes('web') && (
              <button
                type="button"
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className={cn(
                  "p-2 md:p-2.5 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5",
                  webSearchEnabled && "bg-rose-500/10 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                <Globe className="w-3.5 md:w-4 h-3.5 md:h-4" />
              </button>
              )}
            </div>
            <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={cn(
                    'group p-2 md:p-2.5 transition-all duration-300 rounded-full',
                    isListening
                      ? 'text-rose-500 dark:text-rose-300 shadow-md shadow-rose-500/20 dark:shadow-rose-500/20 scale-100 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 animate-pulse'
                      : 'text-rose-500/70 dark:text-rose-300/70 hover:text-rose-500 dark:hover:text-rose-300 scale-95 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 hover:scale-100',
                  )}
                >
                  <Mic className="w-5 md:w-6 h-5 md:h-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isListening ? 'Stop voice input' : 'Start voice input'}
              </TooltipContent>
            </Tooltip>
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation (Esc)"
                className="p-2 md:p-2.5 transition-all duration-300 rounded-full text-rose-500 dark:text-rose-300 hover:shadow-md hover:shadow-rose-500/20 dark:hover:shadow-rose-500/20 scale-100"
              >
                <Square className="w-4 md:w-5 h-4 md:h-5 transition-transform duration-300 animate-pulse" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!value.trim() || isStreaming}
                className={cn(
                  'group p-2 md:p-2.5 transition-all duration-300 rounded-full',
                  (value.trim()) && !isTyping
                    ? 'text-rose-500 dark:text-rose-300 shadow-md shadow-rose-500/20 dark:shadow-rose-500/20 scale-100 hover:bg-rose-500/5 dark:hover:bg-rose-300/5'
                    : 'text-black/30 dark:text-rose-300/30 scale-95',
                )}
              >
                <ArrowRight
                  className={cn(
                    'w-5 md:w-6 h-5 md:h-6 transition-transform duration-300 -rotate-90',
                    (value.trim()) && !isStreaming && 'translate-y-[-2px] group-hover:translate-y-[-4px]',
                  )}
                />
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Premium subtle glow effect in dark mode */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-2xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
    </div>
  )
}

