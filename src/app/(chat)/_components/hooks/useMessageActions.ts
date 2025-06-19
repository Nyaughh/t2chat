'use client'

import { useState, useRef, useEffect } from 'react'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'

interface UseMessageActionsProps {
  onRetryMessage?: (messageId: string, modelId?: string) => void
  onEditMessage?: (messageId: string, content: string) => void
}

export function useMessageActions(props?: UseMessageActionsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [retryDropdownId, setRetryDropdownId] = useState<string | null>(null)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)
  const { speak } = useSpeechSynthesis()

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const handleReadAloud = (text: string, messageId: string) => {
    if (speakingMessageId === messageId) {
      // If the same message is clicked, 'speak' will handle cancellation
      speak(text, () => setSpeakingMessageId(null))
    } else {
      setSpeakingMessageId(messageId)
      speak(text, () => setSpeakingMessageId(null))
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
      if (props?.onEditMessage) {
        props.onEditMessage(editingMessageId, editingContent.trim())
      }
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
    if (props?.onRetryMessage) {
      props.onRetryMessage(messageId, modelId)
    }
    setRetryDropdownId(null)
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
    speakingMessageId,
    editInputRef,
    handleCopy,
    handleReadAloud,
    startEditing,
    cancelEditing,
    saveEdit,
    handleEditKeyDown,
    handleRetryClick,
    handleRetryWithModel,
  }
}
