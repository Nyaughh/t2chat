import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const {
    message,
    conversationId: convId,
  }: { message: { content: string }; conversationId?: string } = await req.json()
  let conversationId = convId
  let newConversationCreated = false

  // If no conversationId is provided, create a new one
  if (!conversationId) {
    const title = message.content.split(' ').slice(0, 5).join(' ') + '...'
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId: userId,
        title: title,
      })
      .returning()
    conversationId = newConversation.id
    newConversationCreated = true
  } else {
    // Verify the user owns the conversation
    const conv = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    })
    if (!conv) {
      return NextResponse.json(
        { error: 'Conversation not found or you do not have permission.' },
        { status: 404 },
      )
    }
  }

  // Add the user message
  const [newUserMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversationId,
      content: message.content,
      role: 'user',
    })
    .returning()

  // Simulate AI response
  const aiResponseContent =
    "This is a simulated AI response from the server. We'll replace this with a real AI later."
  const [newAiMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversationId,
      content: aiResponseContent,
      role: 'assistant',
      model: 'simulated-gemini-pro',
    })
    .returning()

  // Update conversation's lastMessageAt
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId))

  return NextResponse.json({
    conversationId: conversationId,
    userMessage: newUserMessage,
    aiMessage: newAiMessage,
    newConversationCreated,
    ...(newConversationCreated
      ? {
          title: (
            await db.query.conversations.findFirst({
              where: eq(conversations.id, conversationId),
              columns: { title: true },
            })
          )?.title,
        }
      : {}),
  })
} 