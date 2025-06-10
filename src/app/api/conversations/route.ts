import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, messages as messagesTable } from '@/lib/db/schema'
import { eq, desc, asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userConversations = await db.query.conversations.findMany({
    where: eq(conversations.userId, session.user.id),
    with: {
      messages: {
        orderBy: [asc(messagesTable.createdAt)],
      },
    },
    orderBy: [desc(conversations.lastMessageAt)],
  })

  return NextResponse.json(userConversations)
} 