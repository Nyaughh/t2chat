'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { db, type Conversation as DBConversation, type DBMessage } from '../lib/dexie'
import { useUser } from '@clerk/nextjs'

export function useConversations() {
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [messages, setMessages] = useState<DBMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredConversations, setFilteredConversations] = useState<DBConversation[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load conversations from Dexie on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const allConversations = await db.threads.orderBy('lastMessageAt').reverse().toArray()
        setConversations(allConversations)

        const pathMatch = pathname.match(/\/chat\/([^\/]+)/)
        if (pathMatch) {
          const urlId = pathMatch[1]
          if (allConversations.some((c) => c.id === urlId)) {
            setCurrentConversationId(urlId)
          } else {
            router.replace('/')
          }
        } else if (pathname === '/' || pathname === '') {
          setCurrentConversationId('')
        }
      } catch (error) {
        console.error('Error loading conversations from Dexie:', error)
      }
    }
    loadConversations()
  }, [pathname, router])

  // Load messages for the current conversation
  useEffect(() => {
    if (!currentConversationId) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      try {
        const currentMessages = await db.messages
          .where('conversationId')
          .equals(currentConversationId)
          .sortBy('createdAt')
        setMessages(currentMessages)
      } catch (error) {
        console.error('Error loading messages from Dexie:', error)
      }
    }

    loadMessages()
  }, [currentConversationId])

  const currentConversation = useMemo(
    () => conversations.find((conv) => conv.id === currentConversationId),
    [conversations, currentConversationId],
  )

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery) {
        setFilteredConversations(conversations)
        return
      }

      try {
        const lowerCaseQuery = searchQuery.toLowerCase()
        const matchingMessages = await db.messages.toArray()
        const convIdsFromMessages = new Set(
          matchingMessages
            .filter((m) => m.content.toLowerCase().includes(lowerCaseQuery))
            .map((m) => m.conversationId),
        )

        const results = conversations.filter(
          (conv) => conv.title.toLowerCase().includes(lowerCaseQuery) || convIdsFromMessages.has(conv.id),
        )
        setFilteredConversations(results)
      } catch (error) {
        console.error('Error searching conversations:', error)
        setFilteredConversations(conversations)
      }
    }

    performSearch()
  }, [searchQuery, conversations])

  const generateTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 4).join(' ')
    return words.length > 30 ? words.substring(0, 30) + '...' : words
  }

  const createNewConversation = useCallback(() => {
    setCurrentConversationId('')
    router.push('/')
  }, [router])

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await db.transaction('rw', db.threads, db.messages, async () => {
          await db.messages.where({ conversationId }).delete()
          await db.threads.delete(conversationId)
        })

        const updatedConversations = conversations.filter((c) => c.id !== conversationId)
        setConversations(updatedConversations)

        if (currentConversationId === conversationId) {
          if (updatedConversations.length > 0) {
            const nextId = updatedConversations[0].id
            setCurrentConversationId(nextId)
            router.push(`/chat/${nextId}`)
          } else {
            setCurrentConversationId('')
            router.push('/')
          }
        }
      } catch (error) {
        console.error('Error deleting conversation:', error)
      }
    },
    [conversations, currentConversationId, router],
  )

  const navigateToConversation = useCallback(
    (conversationId: string) => {
      setCurrentConversationId(conversationId)
      router.push(`/chat/${conversationId}`)
    },
    [router],
  )

  const addMessageToCurrentConversation = useCallback(
    async (message: Omit<DBMessage, 'id' | 'conversationId' | 'createdAt' | 'parts'>) => {
      if (!currentConversationId) return

      try {
        const newMessage: DBMessage = {
          id: uuidv4(),
          conversationId: currentConversationId,
          content: message.content,
          role: message.role,
          createdAt: new Date(),
          parts: [],
        }

        await db.messages.add(newMessage)
        setMessages((prev) => [...prev, newMessage])

        await db.threads.update(currentConversationId, {
          lastMessageAt: newMessage.createdAt,
          updatedAt: newMessage.createdAt,
        })

        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === currentConversationId
                ? { ...c, lastMessageAt: newMessage.createdAt, updatedAt: newMessage.createdAt }
                : c,
            )
            .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()),
        )
      } catch (error) {
        console.error('Error adding message:', error)
      }
    },
    [currentConversationId],
  )

  const stopGeneratingResponse = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    setIsTyping(false)
    addMessageToCurrentConversation({
      role: 'assistant',
      content: 'Stopped by the user',
    })
  }, [addMessageToCurrentConversation])

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]

    if (lastMessage?.role === 'user' && !isTyping) {
      setIsTyping(true)
      typingTimeoutRef.current = setTimeout(() => {
        const responses = [
          'I understand your question. Let me provide you with a comprehensive answer that addresses your specific needs.',
          "That's a great question! Based on my analysis, here are some insights that might be helpful for you.",
          "I've processed your request and I'm ready to assist you with this. Here's what I recommend:",
          'Excellent! I can definitely help you with that. Let me break this down for you in a clear and actionable way.',
          "Thank you for that question. I've analyzed the context and here's my detailed response:",
        ]

        const response = responses[Math.floor(Math.random() * responses.length)]

        addMessageToCurrentConversation({
          content: response,
          role: 'assistant',
        })

        setIsTyping(false)
        typingTimeoutRef.current = null
      }, 1200)
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [messages, addMessageToCurrentConversation])

  const regenerateResponse = useCallback(
    async (assistantMessageId: string) => {
      if (!currentConversation) return

      try {
        const messageIndex = messages.findIndex((m) => m.id === assistantMessageId)
        if (messageIndex === -1) return

        const messagesToDelete = messages.slice(messageIndex)
        const messageIdsToDelete = messagesToDelete.map((m) => m.id)

        await db.messages.bulkDelete(messageIdsToDelete)

        const newMessages = messages.slice(0, messageIndex)
        setMessages(newMessages)
      } catch (error) {
        console.error('Error regenerating response:', error)
      }
    },
    [currentConversation, messages],
  )

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentConversation) return

      try {
        const messageIndex = messages.findIndex((m) => m.id === messageId)
        if (messageIndex === -1) return

        const messagesToDelete = messages.slice(messageIndex + 1)
        if (messagesToDelete.length > 0) {
          const messageIdsToDelete = messagesToDelete.map((m) => m.id)
          await db.messages.bulkDelete(messageIdsToDelete)
        }

        const newTimestamp = new Date()
        const editedMessage = {
          ...messages[messageIndex],
          content: newContent,
          createdAt: newTimestamp,
        }
        await db.messages.put(editedMessage)

        const updatedMessages = [...messages.slice(0, messageIndex), editedMessage]
        setMessages(updatedMessages)

        await db.threads.update(currentConversation.id, {
          lastMessageAt: newTimestamp,
          updatedAt: newTimestamp,
        })
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversation.id ? { ...c, lastMessageAt: newTimestamp, updatedAt: newTimestamp } : c,
          ),
        )
      } catch (error) {
        console.error('Error editing message:', error)
      }
    },
    [currentConversation, messages],
  )

  const handleSendMessage = useCallback(
    async (message: string, attachments: File[] = []) => {
      if (!message.trim() && attachments.length === 0) return

      const content =
        message.trim() ||
        (attachments.length > 0 ? `Uploaded files: ${attachments.map((f) => f.name).join(', ')}` : '')

      let conversationId = currentConversationId
      let isNewConversation = false

      try {
        if (!conversationId || !currentConversation || pathname === '/') {
          isNewConversation = true
          conversationId = uuidv4()
          const now = new Date()
          const newConv: DBConversation = {
            id: conversationId,
            userId: user?.user?.id ? user.user.id : 'local-user',
            title: generateTitle(content),
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
          }
          await db.threads.add(newConv)
          setConversations((prev) =>
            [newConv, ...prev].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()),
          )
          setCurrentConversationId(conversationId)
        }

        const newMessage: DBMessage = {
          id: uuidv4(),
          conversationId: conversationId,
          content,
          role: 'user',
          createdAt: new Date(),
          parts: [],
        }

        await db.messages.add(newMessage)

        if (!isNewConversation && conversationId) {
          await db.threads.update(conversationId, {
            lastMessageAt: newMessage.createdAt,
            updatedAt: newMessage.createdAt,
          })
          setConversations((prev) =>
            prev
              .map((c) =>
                c.id === conversationId ? { ...c, lastMessageAt: newMessage.createdAt, updatedAt: newMessage.createdAt } : c,
              )
              .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()),
          )
          setMessages((prev) => [...prev, newMessage])
        }

        if (isNewConversation) {
          router.push(`/chat/${conversationId}`)
        }
      } catch (error) {
        console.error('Error sending message:', error)
      }
    },
    [currentConversationId, currentConversation, pathname, router, user?.user?.id],
  )

  return {
    conversations: conversations,
    currentConversationId,
    currentConversation,
    messages,
    isTyping,
    searchQuery,
    filteredConversations,
    createNewConversation,
    setCurrentConversationId: navigateToConversation,
    setSearchQuery,
    deleteConversation,
    handleSendMessage,
    stopGeneratingResponse,
    regenerateResponse,
    editMessage,
  }
}
