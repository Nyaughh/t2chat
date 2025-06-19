'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useParams } from 'next/navigation'
import { MessageList } from '@/app/(chat)/_components/components/MessageList'
import { models } from '@/lib/models'
import { Id } from '../../../../convex/_generated/dataModel'
import { ConvexMessage } from '@/lib/types'
import { Loader2 } from 'lucide-react'

export default function SharedChatPage() {
  const params = useParams()
  const shareId = params.shareId as string

  const sharedChatData = useQuery(api.chat.queries.getSharedChat, { shareId })

  if (sharedChatData === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        {' '}
        <Loader2 className="w-5 h-5 animate-spin" />{' '}
      </div>
    )
  }

  if (sharedChatData === null) {
    return <div className="flex items-center justify-center h-screen">Chat not found or not shared.</div>
  }

  const { chat, messages } = sharedChatData

  return (
    <div className="h-screen">
      <MessageList
        messages={messages.map((m: ConvexMessage) => ({ ...m, id: m._id as Id<'messages'> }))}
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
        isSignedIn={false}
        speakingMessageId={null}
        onReadAloud={function (text: string, messageId: string): void {
          throw new Error('Function not implemented.')
        }}
      />
    </div>
  )
}
