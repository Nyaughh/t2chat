'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy, Check, RotateCcw, Paperclip, Edit3, Send, X, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import AIInput from '@/components/kokonutui/ai-input'
import MessageRenderer from '@/components/MessageRenderer'
import WelcomeScreen from '@/components/WelcomeScreen'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useMutation } from 'convex/react'
import { api } from '@/../convex/_generated/api'
import { db } from '@/lib/db'
import { useAuthenticatedChat, useUnauthenticatedChat } from '@/hooks/use-chat'
import { Message } from '@/lib/types'
import { Id } from '@/../convex/_generated/dataModel'
import { cn } from '@/lib/utils'

interface ChatInterfaceProps {
  conversationId?: string
}

export default function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const { user, loading } = useAuth()
  const getOrCreateUser = useMutation(api.users.getOrCreateUser)
  const migrateMessages = useMutation(api.messages.migrateMessages)

  useEffect(() => {
    if (user) {
      const handleFirstSignIn = async () => {
        const convexUser = await getOrCreateUser({
          workosId: user.id,
          email: user.email ?? '',
        })

        const localMessages = await db.messages.toArray()
        if (localMessages.length > 0) {
          await migrateMessages({
            userId: convexUser,
            messages: localMessages.map(({ content, role }) => ({ content, role })),
          })
          await db.messages.clear()
        }
      }
      handleFirstSignIn()
    }
  }, [user, getOrCreateUser, migrateMessages])
  
  const authenticatedChat = useAuthenticatedChat({
      conversationId: conversationId as Id<'conversations'> | undefined,
  })
  const unauthenticatedChat = useUnauthenticatedChat()

  const {
    messages,
    isTyping,
    handleSendMessage,
    editMessage,
    regenerateResponse,
    stopGeneratingResponse,
    canSendMessage,
    messageCount,
    limit,
  } = user ? authenticatedChat : unauthenticatedChat

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([])
  const [inputValue, setInputValue] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

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

  const handleSendWithAttachments = (message: string) => {
    handleSendMessage(message, pendingAttachments)
    setPendingAttachments([])
    setInputValue('')
  }

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
      editMessage(editingMessageId, editingContent.trim())
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

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus()
      // Position cursor at end
      const length = editingContent.length
      editInputRef.current.setSelectionRange(length, length)
    }
  }, [editingMessageId, editingContent])

  // Handle clicking outside to cancel edit
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingMessageId && editInputRef.current && !editInputRef.current.contains(event.target as Node)) {
        // Check if clicked on save button
        const target = event.target as HTMLElement
        if (!target.closest('[data-edit-controls]')) {
          cancelEditing()
        }
      }
    }

    if (editingMessageId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingMessageId])

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

  // Auto-scroll on new messages or typing start
  useEffect(() => {
    if (isAtBottomRef.current) {
      setTimeout(() => scrollToBottom('smooth'), 100)
    }
  }, [messages, isTyping])

  const showWelcomeScreen = messages.length === 0 && !isTyping && inputValue === ''

  const handleSend = (message: string) => {
    handleSendMessage(message)
    setInputValue('')
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <>
      {/* Welcome Screen or Messages */}
      <AnimatePresence mode="wait">
        {showWelcomeScreen ? (
          <WelcomeScreen key="welcome" onPromptClick={handlePromptClick} />
        ) : (
          <ScrollArea key="messages" className="h-full scrollbar-hide" ref={scrollAreaRef}>
            <div className="pt-16 px-4 md:px-4 pb-48 md:pb-40 space-y-4 max-w-4xl mx-auto">
              {messages.map((message: Message) => (
                <div key={message._id as string} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="group flex flex-col gap-2 max-w-[85%] min-w-0">
                    <div
                      className={`px-4 py-3 break-words overflow-wrap-anywhere ${
                        message.role === 'user'
                          ? 'bg-rose-500/5 dark:bg-rose-300/5 text-black dark:text-white rounded-lg'
                          : 'text-black dark:text-white'
                      }`}
                    >
                      {editingMessageId === message._id ? (
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
                              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                              title="Cancel edit"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={saveEdit}
                              disabled={!editingContent.trim()}
                              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Save edit"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <MessageRenderer
                          content={message.content}
                          className="text-base leading-relaxed break-words overflow-wrap-anywhere"
                        />
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments.map((file: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded px-2 py-1"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="text-xs truncate max-w-32">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(message.content, message._id as string)}
                          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                          title="Copy message"
                        >
                          {copiedId === message._id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => regenerateResponse(message._id)}
                          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                          title="Regenerate response"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {message.role === 'user' && editingMessageId !== message._id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(message._id as string, message.content)}
                          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                          title="Edit message"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
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

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollToBottom && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-30"
          >
            <button
              onClick={() => scrollToBottom('smooth')}
              className="group p-2 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-lg shadow-lg dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/10 hover:scale-110 transition-transform duration-200"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-5 h-5 text-black/60 dark:text-white/60" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Input */}
      <div className={cn('fixed bottom-0 left-0 right-0 z-10', 'pb-[env(safe-area-inset-bottom)]', 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm')}>
        <div className="max-w-4xl mx-auto w-full px-4 md:px-4">
          <div className={cn(!canSendMessage && 'opacity-50 cursor-not-allowed')}>
            <AIInput
              value={inputValue}
              onValueChange={canSendMessage ? setInputValue : () => {}}
              onSend={canSendMessage ? handleSendWithAttachments : () => {}}
              isTyping={isTyping}
              onStop={stopGeneratingResponse}
              onAttachmentClick={canSendMessage ? () => fileInputRef.current?.click() : () => {}}
              pendingAttachments={pendingAttachments}
              onRemoveAttachment={removeAttachment}
            />
          </div>
          {!canSendMessage && (
            <div className="text-center text-sm text-red-500/80 dark:text-red-400/80 pb-2">
              You have reached your message limit of {limit} for {user ? 'today' : 'this session'}. 
              {!user && " Please sign in to continue."}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
