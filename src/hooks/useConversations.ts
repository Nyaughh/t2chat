'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import { toast } from 'sonner'
import type { Conversation as DbConversation, Message } from '@/lib/types'

// The DB types are slightly different, so we'll map them
// We will use the DB Conversation type and adapt where needed.
type StateConversation = DbConversation

const STORAGE_KEY = 't2chat-conversations'
const MIGRATION_KEY = 't2chat-migrated-to-db'

export function useConversations({
  initialConversations,
}: {
  initialConversations?: DbConversation[]
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending: isSessionLoading } = useSession()

  const mapDbConversationToState = (
    dbConvs: DbConversation[],
  ): StateConversation[] => {
    return dbConvs.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      lastMessageAt: new Date(c.lastMessageAt),
      messages: c.messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) })),
    }))
  }

  const [conversations, setConversations] = useState<StateConversation[]>(
    initialConversations ? mapDbConversationToState(initialConversations) : []
  )
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(!initialConversations)
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Effect for initial data loading and migration
  useEffect(() => {
    if (isSessionLoading) return

    const handleInitialLoad = async () => {
      // Only show loading state if we don't have initial conversations
      if (!initialConversations) {
        setIsLoading(true)
      }
      
      if (session?.user) {
        if (!initialConversations) {
          // User is logged in, but no initial data was passed. Fetch from DB
          try {
            const res = await fetch('/api/conversations')
            if (!res.ok) throw new Error('Failed to fetch conversations')
            const dbConvs: DbConversation[] = await res.json()
            setConversations(mapDbConversationToState(dbConvs))
          } catch (error) {
            console.error('Error fetching conversations from DB:', error)
            toast.error('Could not load your conversations.')
          }
        }

        // Migration logic
        const hasMigrated = localStorage.getItem(MIGRATION_KEY)
        const localData = localStorage.getItem(STORAGE_KEY)

        if (localData && !hasMigrated) {
          // Migrate local storage to DB
          toast.info('Migrating local chats to your account...')
          try {
            const localConversations = JSON.parse(localData)
            const res = await fetch('/api/conversations/migrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localConversations),
            })
            if (!res.ok) throw new Error('Migration failed')
            localStorage.setItem(MIGRATION_KEY, 'true')
            localStorage.removeItem(STORAGE_KEY) // Clear local data after migration
            toast.success('Chats migrated successfully!')
            // Refresh conversations from server after migration
            const freshRes = await fetch('/api/conversations')
            const dbConvs: DbConversation[] = await freshRes.json()
            setConversations(mapDbConversationToState(dbConvs))
          } catch (error) {
            console.error('Migration failed:', error)
            toast.error('Failed to migrate local chats.')
          }
        }
      } else {
        // User is logged out, use localStorage
        try {
          const savedConversations = localStorage.getItem(STORAGE_KEY)
          if (savedConversations) {
            const parsed = JSON.parse(savedConversations)
            const loadedConversations = parsed.map((conv: any) => ({
              ...conv,
              createdAt: new Date(conv.createdAt),
              lastMessageAt: new Date(conv.lastMessageAt),
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
              })),
            }))
            setConversations(loadedConversations)
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error)
        }
      }
      setIsLoading(false)
    }
    handleInitialLoad()
  }, [session, isSessionLoading, initialConversations])

  // Effect to set current conversation based on URL
  useEffect(() => {
    const pathMatch = pathname.match(/\/chat\/([^\/]+)/)
    if (pathMatch) {
      const urlId = pathMatch[1]
      if (conversations.find((c) => c.id === urlId)) {
        setCurrentConversationId(urlId)
      }
    } else if (pathname === '/') {
      setCurrentConversationId('')
    }
  }, [pathname, conversations])

  // Effect to save to localStorage for logged-out users
  useEffect(() => {
    if (!session?.user && conversations.length > 0 && !isLoading) {
      try {
        // Convert dates to ISO strings for JSON compatibility
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
      } catch (error) {
        console.error('Error saving to localStorage:', error)
      }
    }
  }, [conversations, session, isLoading])

  const currentConversation = useMemo(
    () => conversations.find((conv) => conv.id === currentConversationId),
    [conversations, currentConversationId],
  )
  
  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation],
  )

  const conversationsWithMessages = useMemo(
    () => conversations.filter((conv) => conv.messages.length > 0),
    [conversations],
  )

  const filteredConversations = useMemo(
    () =>
      conversationsWithMessages.filter(
        (conv) =>
          conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.messages.some((msg) =>
            msg.content.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      ),
    [conversationsWithMessages, searchQuery],
  )

  const navigateToConversation = useCallback(
    (conversationId: string) => {
      setCurrentConversationId(conversationId)
      router.push(`/chat/${conversationId}`)
    },
    [router],
  )
  
  const addMessage = useCallback(async (messageContent: string) => {
    setIsTyping(true)
    const originalConversations = conversations
  
    if (session?.user) {
        // Optimistic update for logged-in users
        const tempUserMessageId = crypto.randomUUID()
        const tempAiMessageId = crypto.randomUUID()
        const activeConversationId = currentConversationId || crypto.randomUUID()

        const userMessage: Message = {
          id: tempUserMessageId,
          content: messageContent,
          role: 'user',
          createdAt: new Date(),
          conversationId: activeConversationId,
          model: null,
        }

        const aiPlaceholder: Message = {
            id: tempAiMessageId,
            content: '...', // Placeholder content
            role: 'assistant',
            createdAt: new Date(),
            conversationId: activeConversationId,
            model: 'pending',
        }
        
        if (currentConversationId) {
            setConversations(prev => prev.map(conv => 
                conv.id === currentConversationId
                    ? {
                        ...conv,
                        messages: [...conv.messages, userMessage, aiPlaceholder],
                        lastMessageAt: new Date(),
                      }
                    : conv
            ));
        } else {
            const newConversation: StateConversation = {
                id: activeConversationId,
                title: messageContent.substring(0, 30),
                messages: [userMessage, aiPlaceholder],
                lastMessageAt: new Date(),
                createdAt: new Date(),
                userId: session.user.id,
            }
            setConversations(prev => [newConversation, ...prev]);
            navigateToConversation(activeConversationId);
        }

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { content: messageContent }, conversationId: currentConversationId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'API error');

            const { userMessage: finalUserMessage, aiMessage, conversationId: updatedConvId, newConversationCreated, title } = data;
            
            const mappedUserMessage = { ...finalUserMessage, createdAt: new Date(finalUserMessage.createdAt) };
            const mappedAiMessage = { ...aiMessage, createdAt: new Date(aiMessage.createdAt) };

            if (newConversationCreated) {
                // The backend created a new conversation, so we replace our temporary one
                setConversations(prev => {
                    const otherConvs = prev.filter(c => c.id !== activeConversationId);
                    const newConversation: StateConversation = {
                        id: updatedConvId,
                        title: title,
                        messages: [ mappedUserMessage, mappedAiMessage ],
                        lastMessageAt: new Date(aiMessage.createdAt),
                        userId: session.user.id,
                        createdAt: new Date(finalUserMessage.createdAt)
                    };
                    return [newConversation, ...otherConvs];
                });
                if (activeConversationId !== updatedConvId) {
                  navigateToConversation(updatedConvId)
                }
            } else {
                // The backend updated an existing conversation
                setConversations(prev => prev.map(conv => 
                    conv.id === updatedConvId
                        ? {
                            ...conv,
                            // Replace placeholder messages with final ones
                            messages: conv.messages
                                .filter(m => m.id !== tempUserMessageId && m.id !== tempAiMessageId)
                                .concat([mappedUserMessage, mappedAiMessage]),
                            lastMessageAt: new Date(aiMessage.createdAt)
                          }
                        : conv
                ));
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message. Your message has not been saved.');
            // Rollback on error
            setConversations(originalConversations);
        } finally {
            setIsTyping(false);
        }
    } else {
        // Logged out: use local state
        const userMessage: Message = {
          id: crypto.randomUUID(),
          content: messageContent,
          role: 'user',
          createdAt: new Date(),
          conversationId: currentConversationId,
          model: null,
        }

        // This is a simplified local implementation
        // A full implementation would require a local AI response simulation
        const aiMessage: Message = {
            id: crypto.randomUUID(),
            content: 'AI response for local mode is not implemented.',
            role: 'assistant',
            createdAt: new Date(),
            conversationId: currentConversationId,
            model: 'local-mock',
        }

        if (currentConversationId) {
             setConversations(prev => prev.map(conv => 
                conv.id === currentConversationId
                    ? {
                        ...conv,
                        messages: [
                            ...conv.messages,
                            userMessage,
                            aiMessage,
                        ],
                        lastMessageAt: new Date()
                      }
                    : conv
            ));
        } else {
            const newConversation: StateConversation = {
                id: crypto.randomUUID(),
                title: messageContent.substring(0, 30),
                messages: [userMessage, aiMessage],
                lastMessageAt: new Date(),
                createdAt: new Date(),
                userId: '',
            }
            setConversations(prev => [newConversation, ...prev]);
            navigateToConversation(newConversation.id);
        }
        setIsTyping(false);
    }
  }, [currentConversationId, session, navigateToConversation])

  const createNewConversation = useCallback(() => {
    if (session?.user) {
      // For logged-in users, a new conversation is created on the first message
      // so we just navigate to the home page.
      router.push('/')
      setCurrentConversationId('')
    } else {
      // For logged-out users, we can create an empty one in local state
      const newId = crypto.randomUUID()
      const newConversation: StateConversation = {
        id: newId,
        title: 'New Chat',
        messages: [],
        lastMessageAt: new Date(),
        createdAt: new Date(),
        userId: '',
      }
      setConversations((prev) => [newConversation, ...prev])
      navigateToConversation(newId)
    }
  }, [router, session, navigateToConversation])

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      // Optimistic deletion
      const originalConversations = conversations
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId),
      )

      if (currentConversationId === conversationId) {
        router.push('/')
        setCurrentConversationId('')
      }

      toast.info('Conversation deleted.', {
        action: {
          label: 'Undo',
          onClick: () => setConversations(originalConversations),
        },
      })

      if (session?.user) {
        try {
          const res = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE',
          })
          if (!res.ok) {
            // Revert on failure
            setConversations(originalConversations)
            toast.error('Failed to delete conversation on the server.')
          }
        } catch (error) {
          console.error('Error deleting conversation:', error)
          setConversations(originalConversations)
          toast.error('An error occurred while deleting the conversation.')
        }
      }
    },
    [conversations, currentConversationId, router, session],
  )

  return {
    conversations: filteredConversations,
    currentConversation,
    currentConversationId,
    isLoading,
    isTyping,
    searchQuery,
    messages,
    setSearchQuery,
    addMessage,
    navigateToConversation,
    createNewConversation,
    deleteConversation,
  }
}
