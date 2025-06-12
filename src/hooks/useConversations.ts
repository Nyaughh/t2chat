'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { db, type Conversation as DBConversation, type DBMessage } from '../lib/dexie'
import { useUser } from '@clerk/nextjs'
import { CoreMessage } from 'ai'
import { parseDataStream } from '../lib/stream-parser'

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
  const abortControllerRef = useRef<AbortController | null>(null)
  const [model, setModel] = useState('gemini-2.0-flash')

  // Load conversations from Dexie on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const allConversations = await db.conversations.orderBy('lastMessageAt').reverse().toArray()
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
        await db.transaction('rw', db.conversations, db.messages, async () => {
          await db.messages.where({ conversationId }).delete()
          await db.conversations.delete(conversationId)
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

  const stopGeneratingResponse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsTyping(false)
    }
  }, [])

  const getAIResponse = useCallback(
    async (history: DBMessage[], modelToUse: string, conversationId: string) => {
      if (!conversationId) return

      setIsTyping(true)
      abortControllerRef.current = new AbortController()

      try {
        const coreHistory: CoreMessage[] = history.reduce((acc: CoreMessage[], m) => {
          if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
            acc.push({ role: m.role, content: m.content })
          }
          return acc
        }, [])

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: coreHistory,
            data: { modelId: modelToUse },
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.body) throw new Error('No response body')

        const assistantId = uuidv4()
        const createdAt = new Date()
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            conversationId: conversationId,
            content: '',
            role: 'assistant',
            createdAt,
            parts: [],
            model: modelToUse,
          },
        ])

        let streamingContent = ''
        const dataStream = parseDataStream(response.body)
        let streamingStarted = false

        for await (const chunk of dataStream) {
          // Check if abort was requested during streaming
          if (abortControllerRef.current?.signal.aborted) {
            console.log('Aborting stream')
            break
          }

          if (!streamingStarted) {
            streamingStarted = true
            // Keep isTyping true during streaming to show stop button
          }

          console.log(chunk)

          if (chunk.type === 'error') {
            console.error('Error in stream:', chunk.value)
            break
          }

          if (chunk.type === 'text') {
            streamingContent += chunk.value
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: streamingContent } : m)),
            )
          }
        }

        // Save the final message (or partial message if aborted)
        const finalAssistantMessage: DBMessage = {
          id: assistantId,
          conversationId: conversationId,
          content: streamingContent,
          role: 'assistant',
          createdAt,
          parts: [],
          model: modelToUse,
        }
        
        // Only save to database if we have content (even partial)
        if (streamingContent.trim()) {
          await db.messages.put(finalAssistantMessage)

          await db.conversations.update(conversationId, {
            lastMessageAt: finalAssistantMessage.createdAt,
            updatedAt: finalAssistantMessage.createdAt,
          })
          setConversations((prev) =>
            prev
              .map((c) =>
                c.id === conversationId
                  ? { ...c, lastMessageAt: finalAssistantMessage.createdAt, updatedAt: finalAssistantMessage.createdAt }
                  : c,
              )
              .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()),
          )
        } else {
          // If no content was received (immediate abort), remove the empty message
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // Handle abort case - ensure we clean up properly
          console.log('Stream aborted by user')
        } else {
          console.error('Error getting AI response:', error)
        }
        
        // If there was an error and we have a partial message, clean it up
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage?.role === 'assistant' && !lastMessage.content.trim()) {
            return prev.slice(0, -1)
          }
          return prev
        })
      } finally {
        setIsTyping(false)
        abortControllerRef.current = null
      }
    },
    [],
  )

  const regenerateResponse = useCallback(
    async (assistantMessageId: string, modelToUse?: string) => {
      if (!currentConversation) return

      try {
        const messageIndex = messages.findIndex((m) => m.id === assistantMessageId)
        if (messageIndex === -1) return

        const messagesForReprompt = messages.slice(0, messageIndex)
        const messagesToDelete = messages.slice(messageIndex)
        const messageIdsToDelete = messagesToDelete.map((m) => m.id)

        await db.messages.bulkDelete(messageIdsToDelete)
        setMessages(messagesForReprompt)
        
        // Use the provided model or fall back to the original message's model or default
        const assistantMessage = messages[messageIndex]
        const finalModel = modelToUse || assistantMessage.model || model
        
        await getAIResponse(messagesForReprompt, finalModel, currentConversation.id)
      } catch (error) {
        console.error('Error regenerating response:', error)
      }
    },
    [currentConversation, messages, getAIResponse, model],
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
        const editedMessage: DBMessage = {
          ...messages[messageIndex],
          content: newContent,
          createdAt: newTimestamp,
        }
        await db.messages.put(editedMessage)

        const updatedMessages = [...messages.slice(0, messageIndex), editedMessage]
        setMessages(updatedMessages)

        await db.conversations.update(currentConversation.id, {
          lastMessageAt: newTimestamp,
          updatedAt: newTimestamp,
        })
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversation.id ? { ...c, lastMessageAt: newTimestamp, updatedAt: newTimestamp } : c,
          ),
        )
        await getAIResponse(updatedMessages, model, currentConversation.id)
      } catch (error) {
        console.error('Error editing message:', error)
      }
    },
    [currentConversation, messages, getAIResponse, model],
  )

  const handleSendMessage = useCallback(
    async (message: string, selectedModel: string, attachments: File[] = []) => {
      if (!message.trim() && attachments.length === 0) return

      setModel(selectedModel)

      const content =
        message.trim() ||
        (attachments.length > 0 ? `Uploaded files: ${attachments.map((f) => f.name).join(', ')}` : '')

      let conversationId = currentConversationId
      const isNewConversation = !conversationId || !currentConversation || pathname === '/'
      let newMessagesHistory: DBMessage[]

      if (isNewConversation) {
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
        await db.conversations.add(newConv)
        setConversations((prev) =>
          [newConv, ...prev].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()),
        )

        const newMessage: DBMessage = {
          id: uuidv4(),
          conversationId,
          content,
          role: 'user',
          createdAt: new Date(),
          parts: [],
        }
        await db.messages.add(newMessage)

        setCurrentConversationId(conversationId)
        setMessages([newMessage])
        newMessagesHistory = [newMessage]

        window.history.pushState({}, '', `/chat/${conversationId}`)
      } else {
        const newMessage: DBMessage = {
          id: uuidv4(),
          conversationId,
          content,
          role: 'user',
          createdAt: new Date(),
          parts: [],
        }
        await db.messages.add(newMessage)
        await db.conversations.update(conversationId, {
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
        newMessagesHistory = [...messages, newMessage]
        setMessages(newMessagesHistory)
      }
      await getAIResponse(newMessagesHistory, selectedModel, conversationId)
    },
    [currentConversationId, currentConversation, pathname, user?.user?.id, messages, getAIResponse],
  )

  return {
    conversations,
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
