import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const conversationId = params.id

  const result = await db
    .delete(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    )
    .returning()

  if (result.length === 0) {
    return NextResponse.json(
      { error: 'Conversation not found or you do not have permission.' },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, deletedId: conversationId })
} 