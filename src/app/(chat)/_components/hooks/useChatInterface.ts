'use client'

import { useState } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessageActions } from './useMessageActions'
import { useScrollToBottom } from './useScrollToBottom'
import { Attachment, ConvexMessage } from '@/lib/types'

export function useChatInterface(chatId?: string, initialMessages?: ConvexMessage[] | null) {
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isNewChat, setIsNewChat] = useState(false)

  const {
    messages: activeMessages,
    isStreaming,
    handleNewMessage,
    handleRetryMessage,
    handleEditMessage,
    handleStopGeneration,
    currentChatId,
    selectedModel,
    setSelectedModel,
    isAuthenticated,
    mounted,
    userSettings,
  } = useConversations(chatId, initialMessages)

  const messageActions = useMessageActions({
    onRetryMessage: handleRetryMessage,
    onEditMessage: handleEditMessage,
  })
  const scrollToBottom = useScrollToBottom(activeMessages, isStreaming)

  const handleSend = (message: string, model: string, options: { webSearch?: boolean }) => {
    if (message.trim() || attachments.length > 0) {
      const mappedAttachments = attachments.map((a) => ({
        name: a.name,
        type: a.type,
        size: a.size,
        url: a.url,
      }))
      if (!currentChatId) {
        setIsNewChat(true)
      }
      handleNewMessage(message, {
        attachments: mappedAttachments,
        modelId: model,
        webSearch: options.webSearch,
      })
      setInputValue('')
      setAttachments([])
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt)
  }

  const showWelcomeScreen = !isNewChat && !currentChatId && activeMessages.length === 0 && inputValue.length === 0

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
    isAuthenticated,
    mounted,
    userSettings,

    // Attachments
    attachments,
    setAttachments,

    // Actions
    handleSend,
    handlePromptClick,
    handleStopGeneration,
    isCurrentlyStreaming,

    // Message actions
    ...messageActions,

    // Scroll
    ...scrollToBottom,
  }
}
