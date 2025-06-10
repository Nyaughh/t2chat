import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string // as ISO string
  model?: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  lastMessage: string // as ISO string
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const localConversations: Conversation[] = await req.json()

  if (!localConversations || localConversations.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No conversations to migrate.',
    })
  }

  try {
    await db.transaction(async (tx) => {
      for (const conv of localConversations) {
        // Check if conversation with this ID already exists for this user
        // This check is a safeguard, but the main protection is onConflictDoNothing
        const existingConv = await tx.query.conversations.findFirst({
          where: (conversations, { and, eq }) =>
            and(
              eq(conversations.id, conv.id),
              eq(conversations.userId, userId),
            ),
        })

        if (existingConv) {
          console.log(`Skipping existing conversation ${conv.id}`)
          continue
        }

        await tx
          .insert(conversations)
          .values({
            id: conv.id,
            userId,
            title: conv.title,
            createdAt: new Date(conv.lastMessage),
            lastMessageAt: new Date(conv.lastMessage),
          })
          .onConflictDoNothing() // This will prevent crashes on duplicate IDs

        if (conv.messages && conv.messages.length > 0) {
          const messagesToInsert = conv.messages.map((msg) => ({
            id: msg.id || uuidv4(),
            conversationId: conv.id, // Use conv.id directly
            content: msg.content,
            role: msg.role,
            createdAt: new Date(msg.timestamp),
            model: msg.model,
          }))
          // Also ignore conflicts for messages, just in case
          await tx.insert(messages).values(messagesToInsert).onConflictDoNothing()
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json({ error: 'Migration failed.' }, { status: 500 })
  }
} 