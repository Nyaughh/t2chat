"use client"

import type React from "react"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAutoResizeTextarea } from "@/hooks/resize-textarea"
import { ArrowUpCircle, Paperclip, Globe, ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

interface AIInputProps {
  onSend?: (message: string) => void;
  isTyping?: boolean;
  onAttachmentClick?: () => void;
  pendingAttachments?: File[];
  onRemoveAttachment?: (index: number) => void;
}

const models = [
  { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model, best for complex tasks' },
  { id: 'gpt-3.5', name: 'GPT-3.5', description: 'Fast and efficient for general tasks' },
  { id: 'claude-3', name: 'Claude 3', description: 'Advanced reasoning and analysis' },
  { id: 'gemini', name: 'Gemini', description: 'Excellent at creative and visual tasks' },
] as const;

export default function AIInput({ onSend, isTyping, onAttachmentClick, pendingAttachments = [], onRemoveAttachment }: AIInputProps) {
  const [value, setValue] = useState("")
  const [selectedModel, setSelectedModel] = useState<typeof models[number]>(models[0])
  const [showModelSelect, setShowModelSelect] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 80,
    maxHeight: 200,
  })

  const handleSend = () => {
    if (value.trim() && onSend && !isTyping) {
      onSend(value.trim())
      setValue("")
      adjustHeight(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative">
      <div className="relative flex flex-col bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl border border-rose-500/10 dark:border-white/10 overflow-visible rounded-xl shadow-lg shadow-rose-500/5 dark:shadow-lg dark:shadow-black/20">
        {/* Subtle gradient overlay for premium look */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/20 pointer-events-none rounded-xl"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/20 dark:to-white/5 pointer-events-none rounded-xl"></div>

        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <div className="relative z-10 p-4 pb-2 border-b border-black/10 dark:border-white/10">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-rose-500/5 dark:bg-rose-300/5 border border-rose-500/20 dark:border-rose-300/20 rounded-lg px-3 py-2 group"
                >
                                      <Paperclip className="w-3.5 h-3.5 text-rose-500/70 dark:text-rose-300/70" />
                  <span className="text-sm text-black dark:text-white truncate max-w-32">{file.name}</span>
                  <button
                    onClick={() => onRemoveAttachment?.(index)}
                    className="text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              setValue(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isTyping}
            className="w-full px-5 py-4 resize-none bg-transparent border-0 outline-none text-base min-h-[80px] leading-relaxed placeholder:text-black/40 dark:placeholder:text-rose-200/30 text-black dark:text-white"
            style={{
              overflow: "hidden",
              outline: "none",
              border: "none",
              boxShadow: "none",
              WebkitAppearance: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div className="h-16">
          <div className="absolute left-4 right-4 bottom-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelSelect(!showModelSelect)}
                  className={cn(
                    "h-10 px-4 text-sm transition-all duration-200 rounded-lg",
                    "bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40",
                    "flex items-center gap-2",
                    "text-black/70 dark:text-white/70",
                    "hover:text-black dark:hover:text-white",
                    "hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <span>{selectedModel.name}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    showModelSelect && "transform rotate-180"
                  )} />
                </button>
                
                <AnimatePresence>
                  {showModelSelect && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 bottom-full mb-2 left-0 bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl rounded-lg border border-rose-500/10 dark:border-white/10 shadow-lg overflow-hidden min-w-[240px]"
                      style={{
                        filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.06))",
                        transform: "translateZ(0)"
                      }}
                    >
                      <div className="py-1 bg-white/70 dark:bg-[oklch(0.18_0.015_25)]/30 backdrop-blur-xl">
                        {models.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model)
                              setShowModelSelect(false)
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 transition-colors",
                              "hover:bg-black/5 dark:hover:bg-white/5",
                              selectedModel.id === model.id && "bg-black/5 dark:bg-white/5",
                              "flex flex-col items-start gap-0.5"
                            )}
                          >
                            <span className="text-sm font-medium text-black dark:text-white">
                              {model.name}
                            </span>
                            <span className="text-xs text-black/60 dark:text-white/60">
                              {model.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={onAttachmentClick}
                className="p-2.5 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2.5 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={(!value.trim() && pendingAttachments.length === 0) || isTyping}
              className={cn(
                "p-2.5 transition-all duration-300 rounded-full",
                (value.trim() || pendingAttachments.length > 0) && !isTyping
                  ? "text-rose-500 dark:text-rose-300 hover:shadow-md hover:shadow-rose-500/20 dark:hover:shadow-rose-500/20 scale-100"
                  : "text-black/30 dark:text-rose-300/30 scale-95",
              )}
            >
              <ArrowUpCircle
                className={cn(
                  "w-6 h-6 transition-transform duration-300",
                  (value.trim() || pendingAttachments.length > 0) && !isTyping && "hover:translate-y-[-2px]",
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Premium subtle glow effect in dark mode */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/5 to-rose-300/0 rounded-xl blur-xl opacity-0 dark:opacity-30 pointer-events-none"></div>
    </div>
  )
}
