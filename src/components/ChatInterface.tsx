'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy, Check, RotateCcw, Paperclip, Edit3, Send, X, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import AIInput from '@/components/kokonutui/ai-input'
import MessageRenderer from '@/components/MessageRenderer'
import WelcomeScreen from '@/components/WelcomeScreen'
import { useConversations } from '@/hooks/useConversations'
import { usePathname } from 'next/navigation'
import { ModelDropdown } from '@/components/ui/model-dropdown'
import { models } from '@/lib/models'

export default function ChatInterface() {
  const pathname = usePathname()
  const {
    messages: activeMessages,
    isStreaming,
    handleNewMessage,
    currentChatId,
    selectedModel,
    setSelectedModel,
  } = useConversations()

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([])
  const [inputValue, setInputValue] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [retryDropdownId, setRetryDropdownId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    setPendingAttachments((prev) => [...prev, ...fileArray])
  }

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = () => {
    if (inputValue.trim() || pendingAttachments.length > 0) {
      handleNewMessage(inputValue, { attachments: [] /* TODO: Map pendingAttachments */ });
      setInputValue('');
      setPendingAttachments([]);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt)
  }

  const startEditing = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const saveEdit = () => {
    if (editingMessageId && editingContent.trim()) {
      console.log("Editing not yet implemented in the new hook.");
      cancelEditing()
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  const handleRetryClick = (messageId: string) => {
    setRetryDropdownId(messageId)
  }

  const handleRetryWithModel = (messageId: string, modelId: string) => {
    console.log("Regenerate not yet implemented in new hook.");
    setRetryDropdownId(null)
  }

  const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return null
    const model = models.find((m) => m.id === modelId)
    return model?.name || modelId
  }

  const getProviderColor = (modelId?: string) => {
    if (!modelId) return 'bg-gray-500'
    const model = models.find((m) => m.id === modelId)
    if (!model) return 'bg-gray-500'

    switch (model.provider) {
      case 'gemini':
        return 'bg-red-500'
      case 'openrouter':
        return 'bg-blue-500'
      case 'groq':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus()
      const length = editingContent.length
      editInputRef.current.setSelectionRange(length, length)
    }
  }, [editingMessageId, editingContent])

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const handleScroll = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]')
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 200
      isAtBottomRef.current = isAtBottom
      setShowScrollToBottom(!isAtBottom)
    }
  }, [])

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]')
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll)
      handleScroll() // Initial check
      return () => viewport.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom('auto')
    }
  }, [activeMessages])

  const showWelcomeScreen = !currentChatId && activeMessages.length === 0 && inputValue.length === 0;

  const isCurrentlyStreaming = (messageId: string) => {
    return isStreaming && activeMessages[activeMessages.length - 1]?.id === messageId
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {showWelcomeScreen ? (
          <WelcomeScreen key="welcome" onPromptClick={handlePromptClick} />
        ) : (
          <ScrollArea key="messages" className="h-full scrollbar-hide" ref={scrollAreaRef}>
            <div className="pt-16 px-4 md:px-4 pb-48 md:pb-40 space-y-4 max-w-4xl mx-auto">
              {activeMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="group flex flex-col gap-2 max-w-[85%] min-w-0">
                    <div
                      className={`px-4 py-3 break-words overflow-wrap-anywhere ${
                        message.role === 'user'
                          ? 'bg-rose-500/5 dark:bg-rose-300/5 text-black dark:text-white rounded-lg'
                          : 'text-black dark:text-white'
                      }`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <textarea
                            ref={editInputRef}
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="w-full bg-transparent border-none outline-none resize-none text-base leading-relaxed break-words overflow-wrap-anywhere"
                            rows={Math.max(1, editingContent.split('\n').length)}
                            style={{ minHeight: '1.5rem' }}
                          />
                          <div className="flex items-center gap-1 justify-end" data-edit-controls>
                            <button
                              onClick={cancelEditing}
                              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
                              title="Cancel edit"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={saveEdit}
                              disabled={!editingContent.trim()}
                              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Save edit"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <MessageRenderer
                          content={message.content as string}
                          thinking={message.thinking}
                          thinkingDuration={message.thinkingDuration}
                          isTyping={message.role === 'assistant' && isCurrentlyStreaming(message.id)}
                          className="text-base leading-relaxed break-words overflow-wrap-anywhere"
                        />
                      )}
                    </div>

                    {message.role === 'assistant' && !isCurrentlyStreaming(message.id) && (
                      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1] relative">
                        {!isStreaming && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopy(message.content as string, message.id)}
                              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
                              title="Copy message"
                            >
                              {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => handleRetryClick(message.id)}
                                className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
                                title="Retry with model selection"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              {retryDropdownId === message.id && (
                                <ModelDropdown
                                  selectedModel={selectedModel.id}
                                  onModelSelect={(modelId) => handleRetryWithModel(message.id, modelId)}
                                  onClose={() => setRetryDropdownId(null)}
                                  className="absolute left-0"
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Model Display: show if model exists and not currently streaming this message */}
                        {message?.modelId && !isCurrentlyStreaming(message.id) && (
                          <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
                            <div className={`w-2 h-2 rounded-full ${getProviderColor(message.modelId)}`} />
                            <span>{getModelDisplayName(message?.modelId)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {message.role === 'user' && editingMessageId !== message.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
                        <button
                          onClick={() => startEditing(message.id, message.content as string)}
                          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
                          title="Edit message"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && activeMessages[activeMessages.length - 1]?.role === 'assistant' && (
                <div className="flex justify-start">
                  <div className="text-black dark:text-white px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-rose-500/60 dark:bg-rose-300/60 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScrollToBottom && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
            className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-30"
          >
            <button
              onClick={() => scrollToBottom('smooth')}
              className="group p-2 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-lg shadow-lg dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/10 hover:scale-110 transition-transform duration-150 ease-[0.25,1,0.5,1]"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-5 h-5 text-black/60 dark:text-white/60" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed md:absolute bottom-0 left-0 right-0 z-30">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <div className="max-w-4xl mx-auto w-full px-4 md:px-4">
          <AIInput
            value={inputValue}
            onValueChange={setInputValue}
            onSend={handleSend}
            isStreaming={isStreaming}
            isTyping={isTyping}
            onStop={() => console.log("Stop generating not implemented.")}
            onAttachmentClick={() => fileInputRef.current?.click()}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={removeAttachment}
            messagesLength={activeMessages.length}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        </div>
      </div>
    </>
  )
}
