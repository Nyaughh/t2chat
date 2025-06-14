'use client'

import { useState } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessageActions } from './useMessageActions'
import { useScrollToBottom } from './useScrollToBottom'
import { useFileUpload } from './useFileUpload'

export function useChatInterface() {
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const {
    messages: activeMessages,
    isStreaming,
    handleNewMessage,
    currentChatId,
    selectedModel,
    setSelectedModel,
  } = useConversations()

  const messageActions = useMessageActions()
  const { pendingAttachments, fileInputRef, handleFileUpload, removeAttachment, clearAttachments } = useFileUpload()
  const scrollToBottom = useScrollToBottom(activeMessages)

  const handleSend = () => {
    if (inputValue.trim() || pendingAttachments.length > 0) {
      handleNewMessage(inputValue, { attachments: [] /* TODO: Map pendingAttachments */ })
      setInputValue('')
      clearAttachments()
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt)
  }

  const showWelcomeScreen = !currentChatId && activeMessages.length === 0 && inputValue.length === 0

  const isCurrentlyStreaming = (messageId: string) => {
    return isStreaming && activeMessages[activeMessages.length - 1]?.id === messageId
  }

  return {
    // State
    inputValue,
    setInputValue,
    isTyping,
    setIsTyping,
    activeMessages,
    isStreaming,
    currentChatId,
    selectedModel,
    setSelectedModel,
    showWelcomeScreen,
    
    // File upload
    pendingAttachments,
    fileInputRef,
    handleFileUpload,
    removeAttachment,
    
    // Actions
    handleSend,
    handlePromptClick,
    isCurrentlyStreaming,
    
    // Message actions
    ...messageActions,
    
    // Scroll
    ...scrollToBottom,
  }
} 