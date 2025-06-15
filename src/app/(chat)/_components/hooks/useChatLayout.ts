'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSidebar } from '@/hooks/useSidebar'
import { useConversations } from '@/hooks/useConversations'
import { useTouch } from '@/hooks/useTouch'
import { useChatSearch } from './useChatSearch'
import { useChatGroups } from './useChatGroups'
import { ConvexChat } from '@/lib/types'

export function useChatLayout() {
  const [mounted, setMounted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { sidebarOpen, toggleSidebar } = useSidebar()
  const {
    chats: activeChats,
    currentChatId,
    deleteConversation,
    unmigratedLocalChats,
  } = useConversations()
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
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleSidebar()
    }
  }

  // Use a consistent sidebar state for SSR - default to closed to prevent flash
  const effectiveSidebarOpen = mounted ? sidebarOpen : false
  // Check if we're on home page (no current conversation)
  const isOnHomePage = !currentChatId

  return {
    mounted,
    settingsOpen,
    setSettingsOpen,
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