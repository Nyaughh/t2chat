'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { models } from '@/lib/models'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

interface ModelDropdownProps {
  selectedModel?: string
  onModelSelect: (modelId: string) => void
  onClose: () => void
  className?: string
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

export function ModelDropdown({ selectedModel, onModelSelect, onClose, className }: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [showAbove, setShowAbove] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      const buttonRect = dropdownRef.current.parentElement?.getBoundingClientRect()
      
      if (buttonRect) {
        // Check if there's enough space below the button
        const spaceBelow = window.innerHeight - buttonRect.bottom
        const dropdownHeight = 250 // max-height of dropdown
        
        // If not enough space below, show above
        setShowAbove(spaceBelow < dropdownHeight && buttonRect.top > dropdownHeight)
      }
    }
  }, [])

  const handleModelSelect = (modelId: string) => {
    onModelSelect(modelId)
    setIsOpen(false)
    onClose()
  }

  const handleRetrySame = () => {
    if (selectedModel) {
      handleModelSelect(selectedModel)
    }
  }

  const handleBackdropClick = () => {
    setIsOpen(false)
    onClose()
  }

  if (!isOpen) return null

  const selectedModelInfo = models.find(m => m.id === selectedModel)

  return (
    <div className={cn("relative z-50", className)}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/40"
        onClick={handleBackdropClick}
      />
      
      {/* Dropdown */}
      <AnimatePresence>
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: showAbove ? 10 : -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: showAbove ? 10 : -10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            "absolute left-0 bg-white dark:bg-[oklch(0.18_0.015_25)] rounded-lg border border-rose-200/50 dark:border-rose-500/20 shadow-2xl overflow-hidden w-[240px]",
            showAbove ? "bottom-0 mb-1" : "top-0 mt-1"
          )}
        >
          {/* Models List */}
          <div className="max-h-[250px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(244 63 94 / 0.3) transparent' }}>
            <div className="p-2">
              {/* Retry Same Button */}
              {selectedModel && (
                <button
                  onClick={handleRetrySame}
                  className="w-full p-2 rounded-md transition-all duration-200 text-left border mb-2 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-500/30 hover:bg-rose-100/50 dark:hover:bg-rose-900/30"
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500 dark:text-rose-300 flex-shrink-0" />
                    <span className="text-sm font-medium text-rose-700 dark:text-rose-200">
                      Retry Same
                    </span>
                  </div>
                </button>
              )}

              {/* Divider */}
              {selectedModel && (
                <div className="border-b border-rose-200/30 dark:border-rose-500/20 mb-2" />
              )}

              {/* Model Options */}
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  className={cn(
                    'w-full p-2 rounded-md transition-all duration-200 text-left border mb-1',
                    'hover:bg-rose-100/50 dark:hover:bg-rose-900/20',
                    selectedModel === model.id
                      ? 'bg-rose-100/50 dark:bg-rose-900/30 border-rose-500/50'
                      : 'border-transparent',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full bg-gradient-to-r flex-shrink-0',
                          getCategoryColor(model.category),
                        )}
                      />
                      <span className="text-sm text-rose-900 dark:text-rose-100 truncate">
                        {model.name}
                      </span>
                    </div>
                    
                    {selectedModel === model.id && (
                      <Check className="w-3.5 h-3.5 text-rose-500 dark:text-rose-300 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
} 