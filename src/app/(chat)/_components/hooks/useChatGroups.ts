'use client'

import { useMemo } from 'react'

export function useChatGroups(filteredChats: any[]) {
  const groupedChats = useMemo(() => {
    if (!filteredChats) return []

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)
    const lastMonth = new Date(today)
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    const groups = {
      today: [] as typeof filteredChats,
      yesterday: [] as typeof filteredChats,
      lastWeek: [] as typeof filteredChats,
      lastMonth: [] as typeof filteredChats,
      older: [] as typeof filteredChats,
    }

    filteredChats.forEach((chat) => {
      const chatDate = new Date(chat.createdAt || chat.lastMessageAt)

      if (chatDate >= today) {
        groups.today.push(chat)
      } else if (chatDate >= yesterday) {
        groups.yesterday.push(chat)
      } else if (chatDate >= lastWeek) {
        groups.lastWeek.push(chat)
      } else if (chatDate >= lastMonth) {
        groups.lastMonth.push(chat)
      } else {
        groups.older.push(chat)
      }
    })

    return [
      { title: 'Today', chats: groups.today },
      { title: 'Yesterday', chats: groups.yesterday },
      { title: 'Last 7 days', chats: groups.lastWeek },
      { title: 'Last 30 days', chats: groups.lastMonth },
      { title: 'Older', chats: groups.older },
    ].filter((group) => group.chats.length > 0)
  }, [filteredChats])

  return {
    groupedChats,
  }
}
