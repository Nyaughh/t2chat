'use client'

import type React from 'react'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/hooks/resize-textarea'
import {
  ArrowUpCircle,
  Check,
  Globe,
  ChevronDown,
  Sparkles,
  Plus,
  Square,
  X,
  FileText,
  Image,
  Upload,
  ArrowUp,
  Mic,
  Code,
  MountainIcon,
  Phone,
  AudioLines,
  ImageIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { getProviderColor, getProviderDisplayName, getVendorColor, ModelInfo, models } from '@/lib/models'
import { useModelPreferences } from '@/hooks/useModelPreferences'
import { getPickerModels, isModelUsable } from '@/lib/modelPreferences'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { buttonVariants } from '@/components/ui/button'
import { ItemHighlight } from '@/components/ui/item-highlight'
import { useSettingsDialog } from '@/components/settings/SettingsDialogProvider'
import { useRouter } from 'next/navigation'

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

const PICKER_PROVIDER_ORDER = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter'] as const

/**
 * What sets a model apart. Most current models handle web search, images and files, so only
 * reasoning and missing attachment support are worth a label.
 */
const modelTraits = (model: ModelInfo): string[] => {
  const traits: string[] = []
  if (model.supportsThinking) traits.push('Reasoning')
  if (!model.attachmentsSuppport.image && !model.attachmentsSuppport.pdf) traits.push('Text only')
  else if (!model.attachmentsSuppport.pdf) traits.push('No PDFs')
  return traits
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
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [imageGenEnabled, setImageGenEnabled] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 40,
    maxHeight: 160,
  })
  const uploadButtonRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const { openSettings } = useSettingsDialog()
  const router = useRouter()

  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const originalTextRef = useRef('')

  const { prefs: modelPrefs, access: modelAccess, isLoading: modelPrefsLoading } = useModelPreferences()

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

  // Models listed in the picker (Settings → Models decides which are hidden; never empty).
  const pickerModels = getPickerModels(modelPrefs, modelAccess)
  const hiddenModelCount =
    models.length - getPickerModels(modelPrefs, { ...modelAccess, serverUnavailable: [] }).length
  // While the user's keys load, don't grey out key-only models they may well have a key for.
  const isModelAvailable = (model: ModelInfo) => modelPrefsLoading || isModelUsable(model, modelAccess)

  const supportsAttachments = selectedModel.attachmentsSuppport.image || selectedModel.attachmentsSuppport.pdf
  const maxFiles = 2

  // Load UI preferences from localStorage
  useEffect(() => {
    const savedWebSearchEnabled = localStorage.getItem('webSearchEnabled')
    if (savedWebSearchEnabled !== null) {
      setWebSearchEnabled(savedWebSearchEnabled === 'true')
    }

    const savedImageGenEnabled = localStorage.getItem('imageGenEnabled')
    if (savedImageGenEnabled !== null) {
      setImageGenEnabled(savedImageGenEnabled === 'true')
    }
  }, [])

  // Save web search preference
  useEffect(() => {
    localStorage.setItem('webSearchEnabled', webSearchEnabled.toString())
  }, [webSearchEnabled])

  // Save image gen preference
  useEffect(() => {
    localStorage.setItem('imageGenEnabled', imageGenEnabled.toString())
  }, [imageGenEnabled])

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

  // Free models (server key, daily limits) first, then one group per provider for models that run
  // on the user's own key. A free model the user has their own key for is listed under its provider.
  const runsFree = (model: ModelInfo) => !!model.isFree && !modelAccess.keyProviders.includes(model.provider)
  const pickerGroups = [
    { key: 'free', label: 'Free', note: 'Daily limits', models: pickerModels.filter(runsFree) },
    ...PICKER_PROVIDER_ORDER.map((provider) => ({
      key: provider,
      label: getProviderDisplayName(provider),
      note: undefined as string | undefined,
      models: pickerModels.filter((model) => model.provider === provider && !runsFree(model)),
    })),
  ].filter((group) => group.models.length > 0)

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
            className="w-full px-3.5 md:px-4 pt-3 pb-1 resize-none bg-transparent border-0 outline-none text-sm md:text-[15px] min-h-[40px] leading-normal placeholder:text-muted-foreground/80 text-foreground"
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

        <div className="h-12 md:h-[52px]">
          <div className="absolute left-2 md:left-2.5 right-2 md:right-2.5 bottom-2 md:bottom-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-1.5">
              <div className="relative min-w-0">
                <button
                  ref={modelButtonRef}
                  type="button"
                  aria-expanded={showModelSelect}
                  aria-label={`Model: ${mounted ? selectedModel.name : models[0].name}. Change model`}
                  onClick={() => setShowModelSelect(!showModelSelect)}
                  className={cn(
                    'h-8 max-w-full px-2 md:px-2.5 text-sm transition-colors duration-150 rounded-md cursor-pointer',
                    'hover:bg-foreground/[0.06] aria-expanded:bg-foreground/[0.06]',
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
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border/70">
                        <h3 className="text-sm font-medium text-foreground">Model</h3>
                        <button
                          type="button"
                          onClick={() => {
                            setShowModelSelect(false)
                            // API keys need an account: guests go to sign in, as with the gear
                            if (!isSignedIn) {
                              router.push('/auth')
                              return
                            }
                            openSettings('keys', { returnFocusTo: modelButtonRef.current })
                          }}
                          className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-7 gap-1 px-2.5 text-xs')}
                        >
                          BYOK
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <div
                        className="max-h-[300px] overflow-y-auto"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(244 63 94 / 0.3) transparent' }}
                      >
                        {pickerGroups.map((group) => (
                          <div key={group.key} className="px-1.5 py-1.5 border-b border-border/60 last:border-b-0">
                            <div className="flex items-baseline justify-between px-2 pt-0.5 pb-1">
                              <span className="text-[11px] font-medium text-muted-foreground">{group.label}</span>
                              {group.note && <span className="text-[11px] text-muted-foreground/70">{group.note}</span>}
                            </div>
                            {group.models.map((model) => {
                              const usable = isModelAvailable(model)
                              const selected = selectedModel.id === model.id
                              const traits = modelTraits(model)
                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    if (usable) {
                                      setSelectedModel(model)
                                      setShowModelSelect(false)
                                    }
                                  }}
                                  disabled={!usable}
                                  title={
                                    usable
                                      ? model.description
                                      : model.isApiKeyOnly
                                        ? `Needs your ${getProviderDisplayName(model.provider)} API key`
                                        : 'Sign in to use this model'
                                  }
                                  className={cn(
                                    'relative w-full overflow-hidden rounded-md px-2 py-1.5 text-left transition-colors duration-150',
                                    selected ? 'text-rose-600 dark:text-rose-300' : 'text-foreground/85 hover:text-foreground',
                                    usable ? 'cursor-pointer' : 'cursor-not-allowed text-foreground/40',
                                  )}
                                >
                                  <ItemHighlight active={selected} />
                                  <span className="relative z-10 flex items-center gap-2">
                                    <span
                                      className={cn('size-1.5 shrink-0 rounded-full bg-gradient-to-r', getVendorColor(model.vendor))}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>
                                    {usable ? (
                                      traits.map((trait) => (
                                        <span key={trait} className="shrink-0 text-[11px] text-muted-foreground">
                                          {trait}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="shrink-0 text-[11px]">{model.isApiKeyOnly ? 'Add key' : 'Sign in'}</span>
                                    )}
                                    {selected && <Check className="size-3.5 shrink-0" />}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>

                      {/* Hidden models stay one click away, so the picker never strands the user */}
                      {isSignedIn && hiddenModelCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowModelSelect(false)
                            openSettings('models', { returnFocusTo: modelButtonRef.current })
                          }}
                          className="flex w-full cursor-pointer items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <span>
                            {hiddenModelCount} {hiddenModelCount === 1 ? 'model' : 'models'} hidden
                          </span>
                          <span>Manage models</span>
                        </button>
                      )}
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
                  aria-label="Web search"
                  title="Web search"
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
                  aria-label="Image generation"
                  title="Image generation"
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
