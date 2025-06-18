'use client'

import { useState, useMemo } from 'react'

export function useChatSearch(chats: any[]) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredChats = useMemo(() => {
    if (!chats) return []
    if (!searchQuery) {
      return chats
    }
    return chats.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [chats, searchQuery])

  return {
    searchQuery,
    setSearchQuery,
    filteredChats,
  }
}
