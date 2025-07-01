'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSidebar } from '@/hooks/useSidebar'
import { useConversations } from '@/hooks/useConversations'
import { useTouch } from '@/hooks/useTouch'
import { useChatSearch } from './useChatSearch'
import { useChatGroups } from './useChatGroups'
import { ConvexChat } from '@/lib/types'
import { useAuth } from '@/hooks/useAuth'
import { useMediaQuery } from 'react-responsive'

export function useChatLayout(initialChats?: ConvexChat[] | null, defaultSidebarOpen?: boolean) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth({})

  const { sidebarOpen, toggleSidebar } = useSidebar(defaultSidebarOpen ?? true)
  const [mounted, setMounted] = useState(false)
  const {
    chats: activeChats,
    currentChatId,
    deleteConversation,
    unmigratedLocalChats,
  } = useConversations(undefined, undefined, initialChats)

  const { onTouchStart, onTouchMove, onTouchEnd } = useTouch({
    onSwipeLeft: () => sidebarOpen && toggleSidebar(),
  })

  const { searchQuery, setSearchQuery, filteredChats } = useChatSearch(activeChats || [])
  const { groupedChats } = useChatGroups(filteredChats)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConversationSelect = (conversationId: string | null) => {
    if (conversationId) {
      router.push(`/chat/${conversationId}`)
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768 && sidebarOpen) {
      toggleSidebar()
    }
  }

  const createNewChat = () => {
    router.push(`/`)
    if (typeof window !== 'undefined' && window.innerWidth < 768 && sidebarOpen) {
      toggleSidebar()
    }
  }

  const effectiveSidebarOpen = mounted ? sidebarOpen : defaultSidebarOpen ?? false

  const isMobile = useMediaQuery({ query: '(max-width: 767px)' })

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
    isOnHomePage: !currentChatId,
    unmigratedLocalChats,
    isMobile,
  }
}
