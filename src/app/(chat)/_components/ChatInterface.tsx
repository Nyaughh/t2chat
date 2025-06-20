'use client'

import { AnimatePresence } from 'framer-motion'
import AIInput from '@/components/kokonutui/ai-input'
import WelcomeScreen from '@/components/WelcomeScreen'
import { useChatInterface } from './hooks/useChatInterface'
import { MessageList } from './components/MessageList'
import { ScrollToBottomButton } from './components/ScrollToBottomButton'
import { SimpleVoiceChat } from './components/SimpleVoiceChat'
import { ChatErrorBoundary } from '@/components/ChatErrorBoundary'
import { useVoiceChatAPI } from '@/hooks/useVoiceChatAPI'
import { models } from '@/lib/models'
import { UploadButton } from '@/lib/uploadthing'
import { Paperclip, FileText, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ConvexMessage } from '@/lib/types'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useRouter } from 'next/navigation'
import { Id } from '../../../../convex/_generated/dataModel'

interface ChatInterfaceProps {
  chatId?: string
  initialMessages?: ConvexMessage[] | null
}

export default function ChatInterface({ chatId, initialMessages }: ChatInterfaceProps = {}) {
  const {
    // State
    inputValue,
    setInputValue,
    isTyping,
    setIsTyping,
    activeMessages,
    isStreaming,
    selectedModel,
    setSelectedModel,
    showWelcomeScreen,
    isAuthenticated,
    mounted,

    // Attachments
    attachments,
    setAttachments,

    // Actions
    handleSend,
    handlePromptClick,
    handleStopGeneration,
    isCurrentlyStreaming,

    // Message actions
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

    // Scroll
    showScrollToBottom,
    messagesEndRef,
    scrollAreaRef,
    scrollToBottom,
    userSettings,
  } = useChatInterface(chatId, initialMessages)

  const maxFiles = 2
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [isUploading, setIsUploading] = useState(false)
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false)
  const branchChat = useMutation(api.chat.mutations.branchChat)
  const createChat = useMutation(api.chat.mutations.createChat)
  const addMessage = useMutation(api.chat.mutations.addMessage)
  const router = useRouter()

  const handleBranch = async (messageId: string) => {
    if (!chatId) return
    try {
      const newChatId = await branchChat({ chatId: chatId as Id<'chats'>, messageId: messageId as Id<'messages'> })
      router.push(`/chat/${newChatId}`)
      toast.success('Chat branched successfully!')
    } catch (error) {
      toast.error('Failed to branch chat.')
      console.error(error)
    }
  }

  const handleUploadComplete = (res: any) => {
    // Clear all progress and uploading state
    setUploadProgress({})
    setIsUploading(false)

    if (res) {
      const remainingSlots = maxFiles - attachments.length
      const filesToAdd = res.slice(0, remainingSlots)
      setAttachments([...attachments, ...filesToAdd])
      if (res.length > remainingSlots) {
        toast.error(`Only added ${remainingSlots} files. Maximum ${maxFiles} files allowed.`)
      } else {
        // Determine file types in the uploaded files
        const pdfCount = filesToAdd.filter((file: any) => file.type?.includes('pdf')).length
        const imageCount = filesToAdd.filter((file: any) => file.type?.startsWith('image/')).length

        let message = `Added ${filesToAdd.length} file${filesToAdd.length > 1 ? 's' : ''}`
        if (pdfCount > 0 && imageCount > 0) {
          message = `Added ${imageCount} image${imageCount > 1 ? 's' : ''} and ${pdfCount} PDF${pdfCount > 1 ? 's' : ''}`
        } else if (pdfCount > 0) {
          message = `Added ${pdfCount} PDF${pdfCount > 1 ? 's' : ''}`
        } else if (imageCount > 0) {
          message = `Added ${imageCount} image${imageCount > 1 ? 's' : ''}`
        }

        toast.success(message)
      }
    }
  }

  const handleUploadError = (error: Error, fileType: 'image' | 'pdf' | 'file' = 'image') => {
    // Clear all progress and uploading state
    setUploadProgress({})
    setIsUploading(false)

    const type = fileType === 'pdf' ? 'PDF' : fileType === 'file' ? 'File' : 'Image'
    toast.error(`${type} upload failed: ${error.message}`)
  }

  const handleVoiceChatToggle = () => {
    setIsVoiceChatOpen(!isVoiceChatOpen)
  }

  const { sendVoiceMessage } = useVoiceChatAPI()

  const handleSaveConversation = async (
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => {
    if (conversationHistory.length === 0) return

    // Check if user is authenticated before trying to save
    if (!isAuthenticated) {
      toast.error('Please sign in to save voice conversations')
      return
    }

    try {
      // Create a new chat with a title based on the first user message
      const firstUserMessage = conversationHistory.find((msg) => msg.role === 'user')
      const title = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'Voice Chat'

      const newChatId = await createChat({ title })

      // Add all messages from the conversation to the new chat
      for (const message of conversationHistory) {
        await addMessage({
          chatId: newChatId,
          role: message.role,
          content: message.content,
          modelId: selectedModel.id,
        })
      }

      // Navigate to the new chat
      router.push(`/chat/${newChatId}`)
      toast.success(`Voice chat saved with ${conversationHistory.length} messages!`)
    } catch (error) {
      console.error('Error saving voice conversation:', error)
      toast.error('Failed to save voice conversation')
    }
  }

  const handleVoiceMessageSend = async (
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => {
    return await sendVoiceMessage(message, selectedModel.id, conversationHistory, userSettings)
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {showWelcomeScreen ? (
          <WelcomeScreen key="welcome" onPromptClick={handlePromptClick} />
        ) : (
          <ChatErrorBoundary>
            <MessageList
              key="messages"
              messages={activeMessages}
              editingMessageId={editingMessageId}
              editingContent={editingContent}
              copiedId={copiedId}
              retryDropdownId={retryDropdownId}
              speakingMessageId={speakingMessageId}
              selectedModel={selectedModel}
              isStreaming={isStreaming}
              editInputRef={editInputRef}
              scrollAreaRef={scrollAreaRef}
              messagesEndRef={messagesEndRef}
              isCurrentlyStreaming={isCurrentlyStreaming}
              onEditingContentChange={setEditingContent}
              onEditKeyDown={handleEditKeyDown}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onSaveEdit={saveEdit}
              onCopy={handleCopy}
              onReadAloud={handleReadAloud}
              onRetryClick={handleRetryClick}
              onRetryWithModel={handleRetryWithModel}
              onCloseRetryDropdown={() => setRetryDropdownId(null)}
              onBranch={handleBranch}
              isSignedIn={isAuthenticated}
            />
          </ChatErrorBoundary>
        )}
      </AnimatePresence>

      <ScrollToBottomButton show={showScrollToBottom} onScrollToBottom={() => scrollToBottom('smooth')} />

      <div className="fixed md:absolute bottom-0 left-0 right-0 z-30">
        <div className="max-w-4xl mx-auto w-full px-4 pb-4 md:px-4">
          <AIInput
            value={inputValue}
            onValueChange={setInputValue}
            onSend={handleSend}
            isStreaming={isStreaming}
            isTyping={isTyping}
            onStop={handleStopGeneration}
            messagesLength={activeMessages.length}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            isSignedIn={isAuthenticated}
            attachments={attachments}
            onRemoveAttachment={(index) => setAttachments(attachments.filter((_, i) => i !== index))}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            mounted={mounted}
            sendBehavior={userSettings?.sendBehavior || 'enter'}
            onVoiceChatToggle={isAuthenticated ? handleVoiceChatToggle : undefined}
            uploadButton={
              selectedModel.attachmentsSuppport.image || selectedModel.attachmentsSuppport.pdf ? (
                <div className={cn('flex gap-1', attachments.length >= maxFiles && 'opacity-50 pointer-events-none')}>
                  <UploadButton
                    endpoint="fileUploader"
                    onBeforeUploadBegin={(files) => {
                      setIsUploading(true)
                      // Filter files based on model support
                      const supportedFiles = files.filter((file) => {
                        const isImage = selectedModel.attachmentsSuppport.image && file.type.startsWith('image/')
                        const isPdf = selectedModel.attachmentsSuppport.pdf && file.type === 'application/pdf'
                        return isImage || isPdf
                      })

                      if (supportedFiles.length === 0) {
                        setIsUploading(false)
                        const supportedTypes = []
                        if (selectedModel.attachmentsSuppport.image) supportedTypes.push('images')
                        if (selectedModel.attachmentsSuppport.pdf) supportedTypes.push('PDFs')
                        toast.error(`This model only supports ${supportedTypes.join(' and ')}`)
                        return []
                      }

                      // Set initial progress for supported files
                      const initialProgress: { [key: string]: number } = {}
                      supportedFiles.forEach((file) => {
                        initialProgress[file.name] = 0
                      })
                      setUploadProgress(initialProgress)
                      return supportedFiles
                    }}
                    onUploadProgress={(progress) => {
                      // Update progress for all current files
                      setUploadProgress((prev) => {
                        const updated = { ...prev }
                        Object.keys(updated).forEach((fileName) => {
                          updated[fileName] = progress
                        })
                        return updated
                      })
                    }}
                    onClientUploadComplete={(res) => {
                      handleUploadComplete(res)
                    }}
                    onUploadError={(error: Error) => {
                      handleUploadError(error, 'file')
                    }}
                    appearance={{
                      button:
                        'w-7 h-7 md:w-8 md:h-8 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300 transition-all duration-200 rounded-lg bg-white/50 dark:bg-[oklch(0.22_0.015_25)]/40 hover:bg-rose-500/5 dark:hover:bg-white/5 flex items-center justify-center max-w-7 max-h-7 md:max-w-8 md:max-h-8',
                      container: 'w-auto h-auto',
                      allowedContent: 'hidden',
                    }}
                    content={{
                      button({ ready, isUploading }) {
                        if (isUploading)
                          return (
                            <div className="w-3.5 md:w-4 h-3.5 md:h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                          )
                        return (
                          <Paperclip className="w-3.5 md:w-4 h-3.5 md:h-4 text-rose-500/60 dark:text-rose-300/60 hover:text-rose-600 dark:hover:text-rose-300" />
                        )
                      },
                      allowedContent() {
                        return null
                      },
                    }}
                  />
                </div>
              ) : null
            }
          />
        </div>
      </div>

      {/* Simple Voice Chat */}
      {/* TODO: feature: voice */}
      <SimpleVoiceChat
        isOpen={isVoiceChatOpen}
        onClose={() => setIsVoiceChatOpen(false)}
        onSaveConversation={handleSaveConversation}
        onSendMessage={handleVoiceMessageSend}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        availableModels={models.filter((model) => !model.isApiKeyOnly)}
      />
    </>
  )
}
