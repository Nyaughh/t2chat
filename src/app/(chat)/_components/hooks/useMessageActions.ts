'use client'

import { useState, useRef, useEffect } from 'react'
import { models } from '@/lib/models'

export function useMessageActions() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [retryDropdownId, setRetryDropdownId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
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
      console.log("Editing not yet implemented in the new hook.")
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
    console.log("Regenerate not yet implemented in new hook.")
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

  return {
    copiedId,
    editingMessageId,
    editingContent,
    setEditingContent,
    retryDropdownId,
    setRetryDropdownId,
    editInputRef,
    handleCopy,
    startEditing,
    cancelEditing,
    saveEdit,
    handleEditKeyDown,
    handleRetryClick,
    handleRetryWithModel,
    getModelDisplayName,
    getProviderColor,
  }
} 