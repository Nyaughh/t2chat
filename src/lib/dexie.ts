import { UIMessage } from 'ai'
import Dexie, { type EntityTable } from 'dexie'

interface Conversation {
  id: string
  userId?: string
  title: string
  createdAt: Date
  updatedAt: Date
  lastMessageAt: Date
}

interface DBMessage {
  id: string
  conversationId: string
  parts: UIMessage['parts']
  content: string
  role: 'user' | 'assistant' | 'system' | 'data'
  createdAt: Date
  model?: string
  thinking?: string
  thinkingDuration?: number
  attachments?: Array<{
    name: string
    type: string
    size: number
    url: string
  }>
}

const db = new Dexie('t2Chat') as Dexie & {
  conversations: EntityTable<Conversation, 'id'>
  messages: EntityTable<DBMessage, 'id'>
}

// Version 1: Initial schema
db.version(1).stores({
  conversations: 'id, userId, title, updatedAt, lastMessageAt',
  messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
})

// Version 2: Add model field to messages (no migration needed since it's optional)
db.version(2).stores({
  conversations: 'id, userId, title, updatedAt, lastMessageAt',
  messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
})

// Version 3: Add thinking fields to messages (no migration needed since they're optional)
db.version(3).stores({
  conversations: 'id, userId, title, updatedAt, lastMessageAt',
  messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
})

export type { Conversation, DBMessage }
export { db }
