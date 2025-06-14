'use client'

import { AnimatePresence } from 'framer-motion'
import AIInput from '@/components/kokonutui/ai-input'
import WelcomeScreen from '@/components/WelcomeScreen'
import { useChatInterface } from './hooks/useChatInterface'
import { MessageList } from './components/MessageList'
import { ScrollToBottomButton } from './components/ScrollToBottomButton'
import { ChatErrorBoundary } from '@/components/ChatErrorBoundary'

export default function ChatInterface() {
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
    
    // Scroll
    showScrollToBottom,
    messagesEndRef,
    scrollAreaRef,
    scrollToBottom,
  } = useChatInterface()

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
              selectedModel={selectedModel.id}
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
              onRetryClick={handleRetryClick}
              onRetryWithModel={handleRetryWithModel}
              onCloseRetryDropdown={() => setRetryDropdownId(null)}
              getModelDisplayName={getModelDisplayName}
              getProviderColor={getProviderColor}
            />
          </ChatErrorBoundary>
        )}
      </AnimatePresence>

      <ScrollToBottomButton
        show={showScrollToBottom}
        onScrollToBottom={() => scrollToBottom('smooth')}
      />

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
