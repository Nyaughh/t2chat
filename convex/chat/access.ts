// Shared access checks and input limits for the chat functions.
// Every public chat function goes through these helpers, so a caller can only
// read or change chats and messages they own.

import { ConvexError, v, type Infer } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { betterAuthComponent } from '../auth'

type AuthCtx = Parameters<typeof betterAuthComponent.getAuthUserId>[0]

/** The signed-in user's id, or a ConvexError when there is no session. */
export const requireUserId = async (ctx: AuthCtx): Promise<Id<'users'>> => {
  const userId = await betterAuthComponent.getAuthUserId(ctx)
  if (!userId) {
    throw new ConvexError('Authentication required')
  }
  return userId as Id<'users'>
}

/** Loads a chat the signed-in user owns. Missing and foreign chats fail the same way. */
export const requireOwnedChat = async (
  ctx: QueryCtx,
  chatId: Id<'chats'>,
): Promise<{ userId: Id<'users'>; chat: Doc<'chats'> }> => {
  const userId = await requireUserId(ctx)
  const chat = await ctx.db.get(chatId)
  if (!chat || chat.userId !== userId) {
    throw new ConvexError('Chat not found or access denied')
  }
  return { userId, chat }
}

/** Loads a message in a chat the signed-in user owns. */
export const requireOwnedMessage = async (
  ctx: QueryCtx,
  messageId: Id<'messages'>,
): Promise<{ userId: Id<'users'>; chat: Doc<'chats'>; message: Doc<'messages'> }> => {
  const userId = await requireUserId(ctx)
  const message = await ctx.db.get(messageId)
  const chat = message ? await ctx.db.get(message.chatId) : null
  if (!message || !chat || chat.userId !== userId) {
    throw new ConvexError('Message not found or access denied')
  }
  return { userId, chat, message }
}

// ---------------------------------------------------------------------------
// Input limits
// ---------------------------------------------------------------------------

export const MAX_MESSAGE_CHARS = 100_000
export const MAX_TITLE_CHARS = 200
export const MAX_ATTACHMENTS = 10
export const MAX_MIGRATED_CHATS = 500
export const MAX_MIGRATED_MESSAGES = 5_000

export const assertMaxLength = (value: string, max: number, what: string) => {
  if (value.length > max) {
    throw new ConvexError(`${what} is too long (max ${max.toLocaleString('en-US')} characters).`)
  }
}

/** Trims a title, caps its length and falls back when it ends up empty. */
export const cleanTitle = (title: string, fallback = 'New chat') => {
  const trimmed = title.trim().slice(0, MAX_TITLE_CHARS)
  return trimmed || fallback
}

export const attachmentValidator = v.object({
  name: v.string(),
  type: v.string(),
  size: v.number(),
  url: v.string(),
})

export type Attachment = Infer<typeof attachmentValidator>

// Uploads go through UploadThing, which serves files from utfs.io or <app>.ufs.sh.
const isUploadThingHost = (hostname: string) =>
  hostname === 'utfs.io' || hostname.endsWith('.utfs.io') || hostname === 'ufs.sh' || hostname.endsWith('.ufs.sh')

/**
 * Only accepts files uploaded through this app: https URLs on UploadThing's
 * hosts, images or PDFs, and at most MAX_ATTACHMENTS of them. The server later
 * downloads these URLs for the model, so arbitrary URLs must never get through.
 */
export const assertValidAttachments = (attachments: Attachment[] | undefined) => {
  if (!attachments) return
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new ConvexError(`Too many attachments (max ${MAX_ATTACHMENTS}).`)
  }
  for (const attachment of attachments) {
    let url: URL
    try {
      url = new URL(attachment.url)
    } catch {
      throw new ConvexError('Attachment URL is not valid.')
    }
    if (url.protocol !== 'https:' || url.username || url.password || !isUploadThingHost(url.hostname)) {
      throw new ConvexError('Attachments must be files uploaded to this app.')
    }
    if (!attachment.type.startsWith('image/') && attachment.type !== 'application/pdf') {
      throw new ConvexError('Only image and PDF attachments are supported.')
    }
    assertMaxLength(attachment.name, 500, 'Attachment name')
  }
}
