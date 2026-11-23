'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Check, Lightbulb, Globe, Eye, Image, Paperclip, FileText, RotateCcw } from 'lucide-react'
import { ModelInfo } from '@/lib/models'
import { cn } from '@/lib/utils'
import { ItemHighlight } from '@/components/ui/item-highlight'
import { AnimatePresence, motion } from 'framer-motion'
import { useModelPreferences } from '@/hooks/useModelPreferences'
import { getSelectableModels } from '@/lib/modelPreferences'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ModelDropdownProps {
  selectedModel: ModelInfo
  onModelSelect: (modelId: string) => void
  onClose: () => void
  className?: string
  isSignedIn: boolean
  apiKeys?: Array<{ service: string }>
}

const getVendorColor = (vendor: string) => {
  switch (vendor) {
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

export function ModelDropdown({
  selectedModel,
  onModelSelect,
  onClose,
  className,
  isSignedIn,
  apiKeys = [],
}: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [showAbove, setShowAbove] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { prefs, access } = useModelPreferences()

  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      const buttonRect = dropdownRef.current.parentElement?.getBoundingClientRect()

      if (buttonRect) {
        const spaceBelow = window.innerHeight - buttonRect.bottom
        const dropdownHeight = 250
        setShowAbove(spaceBelow < dropdownHeight && buttonRect.top > dropdownHeight)
      }
    }
  }, [])

  const handleModelSelect = (modelId: string) => {
    onModelSelect(modelId)
    setIsOpen(false)
    onClose()
  }

  const handleBackdropClick = () => {
    setIsOpen(false)
    onClose()
  }

  if (!isOpen) return null

  // Retry offers the models the user can use and hasn't hidden in Settings → Models.
  const availableModels = getSelectableModels(prefs, {
    isSignedIn,
    keyProviders: apiKeys.map((key) => key.service),
    serverUnavailable: access.serverUnavailable,
  })

  return (
    <div className={cn('relative z-50', className)}>
      <div className="fixed inset-0" onClick={handleBackdropClick} />
      <AnimatePresence>
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: showAbove ? 8 : -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: showAbove ? 8 : -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
          className={cn(
            'surface-popover absolute left-0 rounded-xl overflow-hidden w-[320px] max-w-[calc(100vw-2rem)]',
            showAbove ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <div
            className="max-h-[300px] overflow-y-auto p-1.5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(244 63 94 / 0.3) transparent' }}
          >
            {/* Retry with same model option at top */}
            <button
              onClick={() => handleModelSelect(selectedModel.id)}
              className="menu-item mb-1.5 text-rose-600 dark:text-rose-300"
            >
              <RotateCcw />
              <span className="truncate">Retry with {selectedModel.name}</span>
            </button>
            <div className="-mx-1.5 mb-1.5 h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent dark:via-rose-300/20" />
            
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model.id)}
                className={cn(
                  'group w-full px-2 py-1.5 cursor-pointer transition-colors duration-150 ease-[0.25,1,0.5,1] relative overflow-hidden text-left flex items-center justify-between',
                  selectedModel.id === model.id
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'hover:text-rose-600 dark:hover:text-rose-300 text-foreground/80',
                )}
              >
                <ItemHighlight active={selectedModel.id === model.id} />
                <div className="flex items-center gap-2 min-w-0 flex-1 relative z-10">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full bg-gradient-to-r flex-shrink-0',
                      getVendorColor(model.vendor),
                    )}
                  />
                  <span className="text-sm truncate">{model.name}</span>
                </div>
                <div className="relative z-10 flex items-center gap-1">
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
                  {model.attachmentsSuppport?.image && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                          <Paperclip className="w-3.5 h-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Supports attachments</TooltipContent>
                    </Tooltip>
                  )}
                  {model.attachmentsSuppport?.pdf && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                          <FileText className="w-3.5 h-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Supports PDF attachments</TooltipContent>
                    </Tooltip>
                  )}

                  {/* Thinking icon - always rightmost before check */}
                  {model.supportsThinking && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-rose-500/60 dark:text-rose-300/60 px-1 py-0.5 rounded-full">
                          <Lightbulb
                            className={cn(
                              'w-3.5 h-3.5',
                              selectedModel.id === model.id && 'text-rose-600 dark:text-rose-300',
                            )}
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Thinking mode enabled</TooltipContent>
                    </Tooltip>
                  )}
                  {selectedModel.id === model.id && (
                    <Check className="w-3.5 h-3.5 text-rose-500 dark:text-rose-300 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
