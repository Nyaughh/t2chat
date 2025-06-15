'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useParams } from 'next/navigation'
import { MessageList } from '@/app/(chat)/_components/components/MessageList'
import { models } from '@/lib/models'
import { Id } from '../../../../convex/_generated/dataModel'
import { ConvexMessage } from '@/lib/types'

export default function SharedChatPage() {
  const params = useParams()
  const shareId = params.shareId as string

  const sharedChatData = useQuery(api.chat.queries.getSharedChat, { shareId })

  if (sharedChatData === undefined) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (sharedChatData === null) {
    return <div className="flex items-center justify-center h-screen">Chat not found or not shared.</div>
  }

  const { chat, messages } = sharedChatData

  return (
    <div className="h-screen">
        <MessageList
            messages={messages.map((m: ConvexMessage) => ({ ...m, id: m._id as Id<'messages'>}))}
            editingMessageId={null}
            editingContent=""
            copiedId={null}
            retryDropdownId={null}
            selectedModel={models[0]}
            isStreaming={false}
            editInputRef={{ current: null }}
            scrollAreaRef={{ current: null }}
            messagesEndRef={{ current: null }}
            isCurrentlyStreaming={() => false}
            onEditingContentChange={() => {}}
            onEditKeyDown={() => {}}
            onStartEditing={() => {}}
            onCancelEditing={() => {}}
            onSaveEdit={() => {}}
            onCopy={() => {}}
            onRetryClick={() => {}}
            onRetryWithModel={() => {}}
            onCloseRetryDropdown={() => {}}
            onBranch={() => {}}
            getModelDisplayName={() => ''}
            getProviderColor={() => ''}
            isSignedIn={false}
        />
    </div>
  )
} 