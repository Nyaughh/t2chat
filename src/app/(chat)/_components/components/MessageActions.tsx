'use client'

import { Copy, Check, RotateCcw } from 'lucide-react'
import { ModelDropdown } from '@/components/ui/model-dropdown'
import { ModelInfo } from '@/lib/models'

interface MessageActionsProps {
  messageId: string
  content: string
  modelId?: string
  copiedId: string | null
  retryDropdownId: string | null
  selectedModel: ModelInfo
  isStreaming: boolean
  onCopy: (text: string, messageId: string) => void
  onRetryClick: (messageId: string) => void
  onRetryWithModel: (messageId: string, modelId: string) => void
  onCloseRetryDropdown: () => void
  getModelDisplayName: (modelId?: string) => string | null
  getProviderColor: (modelId?: string) => string
  isSignedIn: boolean
}

export function MessageActions({
  messageId,
  content,
  modelId,
  copiedId,
  retryDropdownId,
  selectedModel,
  isStreaming,
  onCopy,
  onRetryClick,
  onRetryWithModel,
  onCloseRetryDropdown,
  getModelDisplayName,
  getProviderColor,
  isSignedIn,
}: MessageActionsProps) {
  return (
    <div className="flex items-center gap-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1] relative">
      {!isStreaming && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCopy(content, messageId)}
            className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
            title="Copy message"
          >
            {copiedId === messageId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <div className="relative">
            <button
              onClick={() => onRetryClick(messageId)}
              className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
              title="Retry with model selection"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {retryDropdownId === messageId && (
              <ModelDropdown
                selectedModel={selectedModel}
                onModelSelect={(modelId) => onRetryWithModel(messageId, modelId)}
                onClose={onCloseRetryDropdown}
                className="absolute left-0"
                isSignedIn={isSignedIn}
              />
            )}
          </div>
        </div>
      )}

      {/* Model Display: show if model exists and not currently streaming this message */}
      {modelId && (
        <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
          <div className={`w-2 h-2 rounded-full ${getProviderColor(modelId)}`} />
          <span>{getModelDisplayName(modelId)}</span>
        </div>
      )}
    </div>
  )
} 