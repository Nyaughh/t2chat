'use client'

import type React from 'react'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/hooks/resize-textarea'
import {
  ArrowUpCircle,
  Paperclip,
  Globe,
  ChevronDown,
  Sparkles,
  Lightbulb,
  Plus,
  Square,
  X,
  FileText,
  Image,
  Upload,
  ArrowUp,
  Mic,
  Eye,
  Code,
  MountainIcon,
  Phone,
  AudioLines,
  ImageIcon,
} from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { getProviderColor, getProviderDisplayName, getVendorColor, ModelInfo, models } from '@/lib/models'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { buttonVariants } from '@/components/ui/button'
import { ItemHighlight } from '@/components/ui/item-highlight'

interface Attachment {
  name: string
  type: string
  size: number
  url: string
}

interface AIInputProps {
  value: string
  onValueChange: (value: string) => void
  onSend?: (message: string, model: string, options: { webSearch?: boolean; imageGen?: boolean }) => void
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
  onVoiceChatToggle?: () => void
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
  onVoiceChatToggle,
}: AIInputProps) {
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [imageGenEnabled, setImageGenEnabled] = useState(false)
  const [groupBy, setGroupBy] = useState<'provider' | 'vendor'>('provider')
  const [isDragOver, setIsDragOver] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 40,
    maxHeight: 160,
  })
  const uploadButtonRef = useRef<HTMLDivElement>(null)

  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const originalTextRef = useRef('')

  const apiKeys = useQuery(api.api_keys.getApiKeys) || []
  const disabledModels = useQuery(api.api_keys.getDisabledModels) || []

  // Providers the user has added their own API key for
  const hasKeyForProvider = (provider: ModelInfo['provider']) => apiKeys.some((key) => key.service === provider)

  // Speech Recognition setup
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let final_transcript = ''
      let interim_transcript = ''

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript
        } else {
          interim_transcript += event.results[i][0].transcript
        }
      }

      onValueChange(originalTextRef.current + final_transcript + interim_transcript)
      adjustHeight()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error)
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [onValueChange, adjustHeight])

  const handleToggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      originalTextRef.current = value ? value + ' ' : ''
      recognitionRef.current?.start()
    }
    setIsListening(!isListening)
  }

  // Function to check if a model is available to the user
  const isModelAvailable = (model: ModelInfo) => {
    // Check if model is disabled by user
    if (disabledModels.includes(model.id)) {
      return false
    }

    // If user is not signed in, only free models are available
    if (!isSignedIn && !model.isFree) {
      return false
    }

    // If model requires API key and user doesn't have one for that provider, disable it
    if (model.isApiKeyOnly) {
      return hasKeyForProvider(model.provider)
    }

    return true
  }

  // Show all models but filter available ones for selection fallback
  const availableModels = models.filter(isModelAvailable)

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

    const savedImageGenEnabled = localStorage.getItem('imageGenEnabled')
    if (savedImageGenEnabled !== null) {
      setImageGenEnabled(savedImageGenEnabled === 'true')
    }

    const savedGroupBy = localStorage.getItem('groupBy')
    if (savedGroupBy === 'provider' || savedGroupBy === 'vendor') {
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

  // Save image gen preference
  useEffect(() => {
    localStorage.setItem('imageGenEnabled', imageGenEnabled.toString())
  }, [imageGenEnabled])

  // Save groupBy preference
  useEffect(() => {
    localStorage.setItem('groupBy', groupBy)
  }, [groupBy])

  // If selected model is no longer available, switch to a default available one
  useEffect(() => {
    if (!isModelAvailable(selectedModel) && availableModels.length > 0) {
      setSelectedModel(availableModels[0])
    }
  }, [selectedModel, availableModels, setSelectedModel])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // Drag and drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (supportsAttachments && attachments.length < maxFiles) {
        setIsDragOver(true)
      }
    },
    [supportsAttachments, attachments.length, maxFiles],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (!supportsAttachments || attachments.length >= maxFiles) return

      const files = Array.from(e.dataTransfer.files)
      const remainingSlots = maxFiles - attachments.length
      const filesToAdd = files.slice(0, remainingSlots)

      // Filter files based on model support
      const supportedFiles = filesToAdd.filter((file) => {
        const isImage = selectedModel.attachmentsSuppport.image && file.type.startsWith('image/')
        const isPdf = selectedModel.attachmentsSuppport.pdf && file.type === 'application/pdf'
        return isImage || isPdf
      })

      // Try to trigger the upload button
      if (uploadButtonRef.current && supportedFiles.length > 0) {
        const button = uploadButtonRef.current.querySelector('input[type="file"]')

        if (button) {
          const dt = new DataTransfer()
          supportedFiles.forEach((file) => dt.items.add(file))
          ;(button as HTMLInputElement).files = dt.files
          button.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    },
    [supportsAttachments, attachments.length, maxFiles, selectedModel],
  )

  const handleSend = () => {
    if (value.trim() && onSend && !isTyping) {
      onSend(value.trim(), selectedModel.id, { webSearch: webSearchEnabled, imageGen: imageGenEnabled })
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
      const nonThinkingModel = availableModels.find((m) => !m.supportsThinking)
      if (nonThinkingModel) {
        setSelectedModel(nonThinkingModel)
      }
    }
  }

  const groupedModels = models.reduce(
    (acc, model) => {
      const groupKey = groupBy === 'provider' ? model.provider : model.vendor
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
            // When grouped by provider, sort by vendor first, then by name
            if (a.vendor !== b.vendor) {
              return a.vendor.localeCompare(b.vendor)
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
          'surface-glass relative flex flex-col overflow-visible rounded-2xl transition-colors duration-200',
          isDragOver && 'border-rose-500/30 dark:border-rose-300/30',
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

        {/* Attachments Display */}
        {(attachments.length > 0 || isUploading) && (
          <div className="relative z-10 px-3 md:px-4 pt-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-300">
                Attachments ({attachments.length}/{maxFiles})
                {isUploading && <span className="ml-2 text-rose-500/70 dark:text-rose-300/70">Uploading...</span>}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pb-2">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm border border-border"
                >
                  {attachment.type.startsWith('image/') ? (
                    <div className="flex items-center gap-2">
                      {attachment.url && (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="size-8 object-cover rounded-md border border-border"
                        />
                      )}
                    </div>
                  ) : (
                    <FileText className="w-4 h-4 text-rose-500/70 dark:text-rose-300/70" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-foreground/80 truncate max-w-[120px] text-xs font-medium">
                      {attachment.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {(attachment.size / 1024).toFixed(1)}KB
                    </span>
                  </div>
                  {onRemoveAttachment && (
                    <button
                      onClick={() => onRemoveAttachment(index)}
                      aria-label={`Remove ${attachment.name}`}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'size-6')}
                    >
                      <X className="size-3.5" />
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
                      <span className="text-rose-500/70 dark:text-rose-300/70 text-xs">{Math.round(progress)}%</span>
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
            className="w-full px-3 md:px-4 py-2 resize-none bg-transparent border-0 outline-none text-sm md:text-base min-h-[40px] leading-normal placeholder:text-muted-foreground text-foreground"
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
          <div className="absolute left-3 md:left-4 right-3 md:right-4 bottom-3 md:bottom-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-1.5">
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => setShowModelSelect(!showModelSelect)}
                  className={cn(
                    'h-8 max-w-full px-2 md:px-2.5 text-sm transition-colors duration-150 rounded-md cursor-pointer',
                    'bg-foreground/5 hover:bg-foreground/10',
                    'flex min-w-0 items-center gap-1 md:gap-1.5',
                    'text-foreground/80 hover:text-foreground',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div
                      className={cn(
                        'size-2 shrink-0 rounded-full bg-gradient-to-r',
                        getVendorColor(mounted ? selectedModel.vendor : models[0].vendor),
                      )}
                    ></div>
                    <span className="min-w-0 truncate md:max-w-[160px]">
                      {mounted ? selectedModel.name : models[0].name}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-3.5 shrink-0 opacity-60 transition-transform duration-200',
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
                      className="surface-popover absolute z-50 bottom-full mb-2 left-0 rounded-xl overflow-hidden w-[300px] max-w-[calc(100vw-2rem)]"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-rose-500/10 dark:border-rose-300/10">
                        <h3 className="text-sm font-semibold text-foreground">Select Model</h3>
                        <Link
                          href="/settings?tab=models"
                          className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-7 gap-1 px-2.5 text-xs')}
                        >
                          BYOK
                          <Plus className="size-3" />
                        </Link>
                      </div>

                      {/* Compact Controls */}
                      <div className="px-3 py-2 border-b border-rose-500/10 dark:border-rose-300/10">
                        <div className="flex items-center justify-between gap-3">
                          {/* Thinking Mode Toggle */}
                          <div className="flex items-center gap-2">
                            <Lightbulb className="size-3.5 text-rose-500/70 dark:text-rose-300/70" />
                            <span className="text-xs text-foreground/80">Thinking</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleThinkingToggle(!thinkingEnabled)
                              }}
                              className={cn(
                                'relative w-8 h-4 rounded-full transition-colors duration-200 cursor-pointer',
                                thinkingEnabled ? 'bg-rose-500 dark:bg-rose-400' : 'bg-foreground/15',
                              )}
                            >
                              <div
                                className={cn(
                                  'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200',
                                  thinkingEnabled ? 'translate-x-4' : 'translate-x-0',
                                )}
                              />
                            </button>
                          </div>

                          {/* Group By Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/80">Group by</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setGroupBy(groupBy === 'provider' ? 'vendor' : 'provider')
                              }}
                              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-6 w-16 px-2 text-xs')}
                            >
                              {groupBy === 'provider' ? 'Provider' : 'Vendor'}
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
                            className="p-2 border-b border-rose-500/10 dark:border-rose-300/10 last:border-b-0"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full bg-gradient-to-r',
                                  getVendorColor(
                                    groupBy === 'provider' ? groupModels[0]?.provider || groupKey : groupKey,
                                  ),
                                )}
                              ></div>
                              <span className="text-xs font-medium text-rose-500/70 dark:text-rose-300/70 capitalize">
                                {groupBy === 'provider' ? getProviderDisplayName(groupKey) : groupKey}
                              </span>
                              <span className="text-xs text-rose-400/60 dark:text-rose-400/60">
                                ({groupModels.length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {groupModels
                                .filter((model) => !disabledModels.includes(model.id))
                                .map((model) => (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      if (isModelAvailable(model)) {
                                        setSelectedModel(model)
                                        setShowModelSelect(false)
                                      }
                                    }}
                                    className={cn(
                                      'group w-full px-2 py-1.5 transition-colors duration-150 ease-[0.25,1,0.5,1] relative overflow-hidden text-left cursor-pointer',
                                      selectedModel.id === model.id
                                        ? 'text-rose-600 dark:text-rose-300'
                                        : 'hover:text-rose-600 dark:hover:text-rose-300 text-foreground/80',
                                      !thinkingEnabled && model.supportsThinking && 'opacity-40 cursor-not-allowed',
                                      !isModelAvailable(model) && 'opacity-40 cursor-not-allowed',
                                    )}
                                    disabled={(!thinkingEnabled && model.supportsThinking) || !isModelAvailable(model)}
                                    title={
                                      !isModelAvailable(model)
                                        ? model.isApiKeyOnly
                                          ? `Requires ${getProviderDisplayName(model.provider)} API key`
                                          : !isSignedIn && !model.isFree
                                            ? 'Sign in required'
                                            : 'Not available'
                                        : !thinkingEnabled && model.supportsThinking
                                          ? 'Enable thinking mode to use this model'
                                          : undefined
                                    }
                                  >
                                    <ItemHighlight active={selectedModel.id === model.id} />

                                    <div className="flex items-center justify-between relative z-10">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-sm truncate">{model.name}</span>
                                        {groupBy === 'vendor' && model.provider === 'openrouter' && (
                                          <span className="text-[10px] font-medium text-rose-600 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-300/10 px-1.5 py-0.5 rounded-full">
                                            OpenRouter
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {/* Feature icons - ordered: web, vision, imagegen */}
                                        {model.features.includes('web') && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                                                <Globe className="w-3.5 h-3.5" />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Web search enabled</TooltipContent>
                                          </Tooltip>
                                        )}
                                        {model.features.includes('vision') && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                                                <Eye className="w-3.5 h-3.5" />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Vision capabilities</TooltipContent>
                                          </Tooltip>
                                        )}
                                        {model.features.includes('imagegen') && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                                                <Image className="w-3.5 h-3.5" />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Image generation enabled</TooltipContent>
                                          </Tooltip>
                                        )}

                                        {/* Attachment icons - ordered: image, pdf */}
                                        {model.attachmentsSuppport.image && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                                                <Paperclip className="w-3.5 h-3.5" />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Supports attachments</TooltipContent>
                                          </Tooltip>
                                        )}
                                        {model.attachmentsSuppport.pdf && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                                                <FileText className="w-3.5 h-3.5" />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Supports PDF attachments</TooltipContent>
                                          </Tooltip>
                                        )}

                                        {/* Thinking icon - always rightmost */}
                                        {model.supportsThinking && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                                                <Lightbulb
                                                  className={cn(
                                                    'w-3.5 h-3.5',
                                                    thinkingEnabled && selectedModel.id === model.id
                                                      ? 'text-rose-600 dark:text-rose-300'
                                                      : undefined,
                                                  )}
                                                />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Thinking mode enabled</TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
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
                <div ref={uploadButtonRef} className="shrink-0">{uploadButton}</div>
              )}
              {isSignedIn && selectedModel.features.includes('web') && (
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  aria-pressed={webSearchEnabled}
                  className={cn(buttonVariants({ variant: webSearchEnabled ? 'default' : 'ghost', size: 'icon-sm' }), 'shrink-0')}
                >
                  <Globe />
                </button>
              )}
              {isSignedIn && selectedModel.features.includes('imagegen') && (
                <button
                  type="button"
                  onClick={() => setImageGenEnabled(!imageGenEnabled)}
                  aria-pressed={imageGenEnabled}
                  className={cn(buttonVariants({ variant: imageGenEnabled ? 'default' : 'ghost', size: 'icon-sm' }), 'shrink-0')}
                >
                  <ImageIcon />
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleToggleListening}
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                    aria-pressed={isListening}
                    className={cn(
                      buttonVariants({ variant: isListening ? 'default' : 'ghost', size: 'icon' }),
                      'size-8 md:size-9 rounded-full',
                      isListening && 'animate-pulse',
                    )}
                  >
                    <Mic className="size-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{isListening ? 'Stop voice input' : 'Start voice input'}</TooltipContent>
              </Tooltip>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="Stop generation (Esc)"
                  aria-label="Stop generation"
                  className={cn(buttonVariants({ variant: 'default', size: 'icon' }), 'size-8 md:size-9 rounded-full')}
                >
                  <Square className="size-3.5 fill-current animate-pulse" />
                </button>
              ) : value.trim() ? (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isStreaming}
                  aria-label="Send message"
                  className={cn(buttonVariants({ variant: 'default', size: 'icon' }), 'group size-8 md:size-9 rounded-full')}
                >
                  <ArrowUp className="size-[18px] transition-transform duration-200 group-hover:-translate-y-0.5" />
                </button>
              ) : (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (!onVoiceChatToggle) {
                          // When disabled, show tooltip on mobile by preventing default action
                          e.preventDefault()
                          // Force tooltip to show by triggering pointer events
                          const event = new PointerEvent('pointerenter', { bubbles: true })
                          e.currentTarget.dispatchEvent(event)
                          setTimeout(() => {
                            const leaveEvent = new PointerEvent('pointerleave', { bubbles: true })
                            e.currentTarget.dispatchEvent(leaveEvent)
                          }, 2000)
                          return
                        }
                        onVoiceChatToggle()
                      }}
                      onTouchStart={(e) => {
                        if (!onVoiceChatToggle) {
                          // Show tooltip on touch for mobile
                          const event = new PointerEvent('pointerenter', { bubbles: true })
                          e.currentTarget.dispatchEvent(event)
                        }
                      }}
                      disabled={false}
                      aria-label={onVoiceChatToggle ? 'Start voice chat' : 'Sign in to use voice chat'}
                      aria-disabled={!onVoiceChatToggle}
                      className={cn(
                        buttonVariants({ variant: 'default', size: 'icon' }),
                        'group size-8 md:size-9 rounded-full',
                        onVoiceChatToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <AudioLines className="size-[18px] transition-transform duration-200 group-hover:scale-110" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {onVoiceChatToggle ? 'Start voice chat' : 'Sign in to use voice chat'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
