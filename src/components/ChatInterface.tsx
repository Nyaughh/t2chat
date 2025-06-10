'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy, Check, Paperclip, Send, X, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import AIInput from '@/components/kokonutui/ai-input'
import MessageRenderer from '@/components/MessageRenderer'
import WelcomeScreen from '@/components/WelcomeScreen'
import { useConversations } from '@/hooks/useConversations'

export default function ChatInterface() {
  const { messages, isTyping, addMessage, isLoading } = useConversations()

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  const handleSend = (message: string) => {
    if (message.trim()) {
      addMessage(message.trim())
      setInputValue('')
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt)
  }

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

  const showWelcomeScreen = !isLoading && messages.length === 0 && !isTyping

  return (
    <>
      {/* Welcome Screen, Loading, or Messages */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <div key="loading" className="flex items-center justify-center h-full">
            <div className="text-lg text-black/50 dark:text-white/50">Loading chat...</div>
          </div>
        ) : showWelcomeScreen ? (
          <WelcomeScreen key="welcome" onPromptClick={handlePromptClick} />
        ) : (
          <ScrollArea key="messages" className="h-full scrollbar-hide" ref={scrollAreaRef}>
            <div className="pt-16 px-4 md:px-4 pb-48 md:pb-40 space-y-4 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="group flex flex-col gap-2 max-w-[85%] min-w-0">
                    <div
                      className={`px-4 py-3 break-words overflow-wrap-anywhere ${
                        message.role === 'user'
                          ? 'bg-rose-500/5 dark:bg-rose-300/5 text-black dark:text-white rounded-lg'
                          : 'text-black dark:text-white'
                      }`}
                    >
                      <MessageRenderer
                        content={message.content}
                        className="text-base leading-relaxed break-words overflow-wrap-anywhere"
                      />
                    </div>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(message.content, message.id)}
                          className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-colors"
                          title="Copy message"
                        >
                          {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
            className="absolute bottom-32 right-4 z-20"
          >
            <button
              onClick={() => scrollToBottom()}
              className="p-2 rounded-full bg-rose-500/10 dark:bg-rose-300/10 text-rose-600 dark:text-rose-300 backdrop-blur-sm shadow-lg"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <AIInput
            value={inputValue}
            onValueChange={setInputValue}
            onSend={handleSend}
            isTyping={isTyping}
            placeholder="Ask me anything..."
          />
        </div>
      </div>
    </>
  )
}
