'use client'

import { useState, useRef } from 'react'

export function useFileUpload() {
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    setPendingAttachments((prev) => [...prev, ...fileArray])
  }

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAttachments = () => {
    setPendingAttachments([])
  }

  return {
    pendingAttachments,
    fileInputRef,
    handleFileUpload,
    removeAttachment,
    clearAttachments,
  }
} 