'use client'

import { Copy, Check, RotateCcw, GitFork, Volume2, VolumeX } from 'lucide-react'
import { ModelDropdown } from '@/components/ui/model-dropdown'
import { getModelDisplayName, getVendorColor, ModelInfo } from '@/lib/models'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'

interface MessageActionsProps {
  messageId: string
  content: string
  modelId?: string
  copiedId: string | null
  retryDropdownId: string | null
  speakingMessageId: string | null
  selectedModel: ModelInfo
  isStreaming: boolean
  onCopy: (text: string, messageId: string) => void
  onReadAloud: (text: string, messageId: string) => void
  onRetryClick: (messageId: string) => void
  onRetryWithModel: (messageId: string, modelId: string) => void
  onCloseRetryDropdown: () => void
  onBranch: (messageId: string) => void
  isSignedIn: boolean
}

export function MessageActions({
  messageId,
  content,
  modelId,
  copiedId,
  retryDropdownId,
  speakingMessageId,
  selectedModel,
  isStreaming,
  onCopy,
  onReadAloud,
  onRetryClick,
  onRetryWithModel,
  onCloseRetryDropdown,
  onBranch,
  isSignedIn,
}: MessageActionsProps) {
  const apiKeys = useQuery(api.api_keys.getApiKeys, isSignedIn ? {} : 'skip') || []
  return (
    <div className="flex items-center gap-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1] relative">
      {!isStreaming && (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onCopy(content, messageId)}
                className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
              >
                {copiedId === messageId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{copiedId === messageId ? 'Copied!' : 'Copy message'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onReadAloud(content, messageId)}
                className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
              >
                {speakingMessageId === messageId ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{speakingMessageId === messageId ? 'Stop reading' : 'Read aloud'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onBranch(messageId)}
                className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
              >
                <GitFork className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Branch from this message</TooltipContent>
          </Tooltip>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onRetryClick(messageId)}
                  className="p-1.5 text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 hover:bg-rose-500/5 dark:hover:bg-rose-300/5 rounded transition-all duration-150 ease-[0.25,1,0.5,1] hover:scale-110"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Retry with model selection</TooltipContent>
            </Tooltip>
            {retryDropdownId === messageId && (
              <ModelDropdown
                selectedModel={selectedModel}
                onModelSelect={(modelId) => onRetryWithModel(messageId, modelId)}
                onClose={onCloseRetryDropdown}
                className="absolute left-0"
                isSignedIn={isSignedIn}
                apiKeys={apiKeys}
              />
            )}
          </div>
        </div>
      )}

      {/* Model Display: show if model exists and not currently streaming this message */}
      {modelId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50 cursor-help">
              <div className={`w-2 h-2 rounded-full ${getVendorColor(modelId)}`} />
              <span>{getModelDisplayName(modelId)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Generated by {getModelDisplayName(modelId)}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
