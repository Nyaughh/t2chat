'use client'

import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/../convex/_generated/api'
import { Id } from '@/../convex/_generated/dataModel'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Doc } from '@/../convex/_generated/dataModel'

export function useConversations() {
  const { user: workosUser } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const convexUser = useQuery(
    api.users.getUserByWorkosId,
    workosUser ? { workosId: workosUser.id } : 'skip',
  )
  const userId = convexUser?._id

  const conversations = useQuery(api.conversations.list, userId ? { userId } : 'skip')
  const createConversation = useMutation(api.conversations.create)
  const deleteConversation = useMutation(api.conversations.remove)

  const handleCreateConversation = async () => {
    if (!userId) return
    const conversationId = await createConversation({ userId })
    router.push(`/chat/${conversationId}`)
    return conversationId
  }

  const handleDeleteConversation = async (conversationId: Id<'conversations'>) => {
    await deleteConversation({ conversationId })
    // NOTE: Navigation logic after deletion should be handled in the component
    // For example, navigate to the first conversation or to the home page.
  }

  const filteredConversations = conversations?.filter((c: Doc<'conversations'>) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return {
    userId,
    conversations: conversations || [],
    filteredConversations: filteredConversations || [],
    searchQuery,
    setSearchQuery,
    createConversation: handleCreateConversation,
    deleteConversation: handleDeleteConversation,
  }
} 