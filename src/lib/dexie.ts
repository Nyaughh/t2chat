import { UIMessage } from 'ai'
import Dexie, { type EntityTable } from 'dexie'
import { v4 as uuidv4 } from 'uuid'
import { planLegacyCleanup } from './local-data-policy'

interface Conversation {
  id: string
  /** Owner of this local chat. Unset for unowned guest chats (see local-data-policy.ts). */
  userId?: string
  /** Owner was written by an older client; hidden until that user signs in again. */
  legacyOwner?: boolean
  /** Guest replies still being written here, in any tab: messageId -> lease expiry (epoch ms). */
  inFlight?: Record<string, number>
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

// Version 4: IndexedDB now holds local (guest) chats only, each with its owner
// in `userId` (audit S7). Older builds copied every signed-in user's Convex
// chats and messages in here, and those copies stayed after sign-out. This
// upgrade drops the copies (Convex still has them), moves local messages that
// were sent into a copied chat to a fresh "Recovered chat", and normalizes the
// owner field older clients wrote. See planLegacyCleanup for the rules.
db.version(4)
  .stores({
    conversations: 'id, userId, title, updatedAt, lastMessageAt',
    messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
  })
  .upgrade(async (tx) => {
    const conversations = tx.table('conversations')
    const messages = tx.table('messages')
    const plan = planLegacyCleanup(await conversations.toArray(), await messages.toArray(), uuidv4)
    await messages.bulkDelete(plan.deleteMessageIds)
    await conversations.bulkDelete(plan.deleteConversationIds)
    await conversations.bulkPut(plan.putConversations)
    for (const move of plan.moveMessages) {
      await messages.update(move.id, { conversationId: move.conversationId })
    }
  })

export type { Conversation, DBMessage }
export { db }
