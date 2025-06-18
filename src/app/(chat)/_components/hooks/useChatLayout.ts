'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSidebar } from '@/hooks/useSidebar'
import { useConversations } from '@/hooks/useConversations'
import { useTouch } from '@/hooks/useTouch'
import { useChatSearch } from './useChatSearch'
import { useChatGroups } from './useChatGroups'
import { ConvexChat } from '@/lib/types'

export function useChatLayout(initialChats?: ConvexChat[] | null) {
  const [mounted, setMounted] = useState(false)
  const { sidebarOpen, toggleSidebar } = useSidebar()
  const {
    chats: activeChats,
    currentChatId,
    deleteConversation,
    unmigratedLocalChats,
  } = useConversations(undefined, undefined, initialChats)
  const router = useRouter()

  const { onTouchStart, onTouchMove, onTouchEnd } = useTouch({
    onSwipeLeft: () => sidebarOpen && toggleSidebar(),
  })

  const { searchQuery, setSearchQuery, filteredChats } = useChatSearch(activeChats || [])
  const { groupedChats } = useChatGroups(filteredChats)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConversationSelect = (conversationId: string) => {
    router.push(`/chat/${conversationId}`)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleSidebar()
    }
  }

  const createNewChat = () => {
    router.push(`/`)
    // Only close the sidebar if it's currently open on small screens
    if (typeof window !== 'undefined' && window.innerWidth < 768 && sidebarOpen) {
      toggleSidebar()
    }
  }

  // Use a consistent sidebar state for SSR - default to closed to prevent flash
  const effectiveSidebarOpen = mounted ? sidebarOpen : false
  // Check if we're on home page (no current conversation)
  const isOnHomePage = !currentChatId

  return {
    mounted,
    sidebarOpen,
    toggleSidebar,
    effectiveSidebarOpen,
    activeChats,
    currentChatId,
    deleteConversation,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    searchQuery,
    setSearchQuery,
    groupedChats,
    handleConversationSelect,
    createNewChat,
    isOnHomePage,
    unmigratedLocalChats,
  }
}
