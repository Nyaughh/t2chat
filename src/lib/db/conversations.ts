import { db } from '@/lib/db'
import { conversations, messages as messagesTable } from '@/lib/db/schema'
import { eq, desc, asc } from 'drizzle-orm'

export async function getConversations(userId: string) {
  if (!userId) {
    return []
  }

  const userConversations = await db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    with: {
      messages: {
        orderBy: [asc(messagesTable.createdAt)],
      },
    },
    orderBy: [desc(conversations.lastMessageAt)],
  })

  return userConversations
} 