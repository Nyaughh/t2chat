// Streaming storage for assistant replies.
//
// While a reply streams, its text lives outside the `messages` row so progress
// doesn't invalidate the chat's message list:
// - `streamingMessages`: one small row per in-progress reply with the open
//   tail of the text (under SEGMENT_CHARS) and counters.
// - `streamSegments`: immutable, append-only full segments of the text.
// The action sends only the new text since its last write (with an offset, so
// a retried write is idempotent). Clients subscribe to the small rows and to
// each segment once, so an update costs at most one tail, never the whole text.
//
// Every terminal write goes through this module and is guarded here:
// - finalizeStream writes the final text once. A stopped reply keeps the stop
//   note, and a reply already closed (expired) is never reopened.
// - expireStream closes replies whose action died, keeping the text shown.
// - Writes to a closed reply are no-ops, and report "stop" to the action.

import { v } from 'convex/values'
import { internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import { requireOwnedChat, requireOwnedMessage, requireUserId, toolCallsValidator } from './access'

export const STOPPED_NOTE = '\n\n*Generation was stopped by user.*'
export const INTERRUPTED_NOTE = '\n\n*Generation was interrupted.*'

/** Size of an immutable segment. The open tail is always shorter than this. */
export const SEGMENT_CHARS = 4_000

/** Longer than Convex's 10-minute action limit: a reply still open after this has no live action. */
export const STREAM_EXPIRY_MS = 11 * 60 * 1000

/** Segments deleted per transaction when discarding a stream (each is at most ~16 KB). */
const DISCARD_BATCH = 256

type Kind = 'content' | 'thinking'

export const getStreamRow = (ctx: QueryCtx, messageId: Id<'messages'>) =>
  ctx.db
    .query('streamingMessages')
    .withIndex('by_message', (q) => q.eq('messageId', messageId))
    .first()

/** Reassembles the text streamed so far (segments in order, then the open tail). */
export const readStreamText = async (ctx: QueryCtx, row: Doc<'streamingMessages'>) => {
  const read = async (kind: Kind, tail: string) => {
    const segments = await ctx.db
      .query('streamSegments')
      .withIndex('by_message_kind_index', (q) => q.eq('messageId', row.messageId).eq('kind', kind))
      .collect()
    return segments.map((segment) => segment.text).join('') + tail
  }
  return { content: await read('content', row.contentTail), thinking: await read('thinking', row.thinkingTail) }
}

/**
 * Deletes a reply's streaming row and segments. Large streams continue in a
 * scheduled job, so this stays within transaction limits.
 */
export const discardStreamArtifacts = async (ctx: MutationCtx, messageId: Id<'messages'>) => {
  const row = await getStreamRow(ctx, messageId)
  if (row) await ctx.db.delete(row._id)
  const segments = await ctx.db
    .query('streamSegments')
    .withIndex('by_message_kind_index', (q) => q.eq('messageId', messageId))
    .take(DISCARD_BATCH)
  for (const segment of segments) {
    await ctx.db.delete(segment._id)
  }
  if (segments.length === DISCARD_BATCH) {
    await ctx.scheduler.runAfter(0, internal.chat.streaming.discardStream, { messageId })
  }
}

/** Appends new text to one kind of a stream, moving full segments out of the tail. */
const appendText = async (
  ctx: MutationCtx,
  row: Doc<'streamingMessages'>,
  kind: Kind,
  offset: number,
  delta: string,
) => {
  const length = kind === 'content' ? row.contentLength : row.thinkingLength
  let tail = kind === 'content' ? row.contentTail : row.thinkingTail
  let segments = kind === 'content' ? row.contentSegments : row.thinkingSegments

  // The caller's offset must not skip text; overlap from a retried write is ignored
  if (offset > length) return { tail, segments, length }
  const fresh = delta.slice(length - offset)
  tail += fresh
  while (tail.length >= SEGMENT_CHARS) {
    await ctx.db.insert('streamSegments', { messageId: row.messageId, kind, index: segments, text: tail.slice(0, SEGMENT_CHARS) })
    segments++
    tail = tail.slice(SEGMENT_CHARS)
  }
  return { tail, segments, length: length + fresh.length }
}

// ---------------------------------------------------------------------------
// Writes (internal: only the chat actions and the scheduler call these)
// ---------------------------------------------------------------------------

/**
 * Appends a streaming reply's new text. Returns the stored lengths (the
 * action continues from them) and whether to stop: the user pressed stop, or
 * the reply was closed or deleted. A closed reply is never written to.
 */
export const writeStreamProgress = internalMutation({
  args: {
    messageId: v.id('messages'),
    contentOffset: v.number(),
    contentDelta: v.string(),
    thinkingOffset: v.number(),
    thinkingDelta: v.string(),
  },
  handler: async (
    ctx,
    { messageId, contentOffset, contentDelta, thinkingOffset, thinkingDelta },
  ): Promise<{ stop: boolean; contentLength: number; thinkingLength: number }> => {
    await requireUserId(ctx)
    if (!(await ctx.db.get(messageId))) {
      return { stop: true, contentLength: contentOffset, thinkingLength: thinkingOffset }
    }
    const { message } = await requireOwnedMessage(ctx, messageId)

    let row = await getStreamRow(ctx, messageId)
    if (message.isComplete || message.isCancelled) {
      return { stop: true, contentLength: row?.contentLength ?? 0, thinkingLength: row?.thinkingLength ?? 0 }
    }

    if (!row) {
      const rowId = await ctx.db.insert('streamingMessages', {
        messageId,
        chatId: message.chatId,
        contentTail: '',
        contentSegments: 0,
        contentLength: 0,
        thinkingTail: '',
        thinkingSegments: 0,
        thinkingLength: 0,
        updatedAt: Date.now(),
      })
      row = (await ctx.db.get(rowId))!
    }

    const content = await appendText(ctx, row, 'content', contentOffset, contentDelta)
    const thinking = await appendText(ctx, row, 'thinking', thinkingOffset, thinkingDelta)
    await ctx.db.patch(row._id, {
      contentTail: content.tail,
      contentSegments: content.segments,
      contentLength: content.length,
      thinkingTail: thinking.tail,
      thinkingSegments: thinking.segments,
      thinkingLength: thinking.length,
      updatedAt: Date.now(),
    })
    return { stop: false, contentLength: content.length, thinkingLength: thinking.length }
  },
})

/** Whether the action should stop (stopped, closed or deleted). Polled only while the stream is quiet. */
export const getStreamStatus = internalQuery({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }): Promise<{ stop: boolean }> => {
    await requireUserId(ctx)
    if (!(await ctx.db.get(messageId))) return { stop: true }
    const { message } = await requireOwnedMessage(ctx, messageId)
    return { stop: !!(message.isComplete || message.isCancelled) }
  },
})

/**
 * The one terminal write of a streamed reply. If the user stopped it, the
 * text keeps the stop note (whatever the action believed). If it was already
 * closed some other way (expired), nothing is reopened or overwritten.
 */
export const finalizeStream = internalMutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
    thinking: v.optional(v.string()),
    thinkingDuration: v.optional(v.number()),
    toolCalls: v.optional(toolCallsValidator),
  },
  handler: async (ctx, { messageId, content, thinking, thinkingDuration, toolCalls }) => {
    await requireUserId(ctx)
    if (!(await ctx.db.get(messageId))) return { written: false }
    const { message } = await requireOwnedMessage(ctx, messageId)

    if (message.isComplete && !message.isCancelled) {
      await discardStreamArtifacts(ctx, messageId)
      return { written: false }
    }

    const finalContent = message.isCancelled && !content.endsWith(STOPPED_NOTE) ? content + STOPPED_NOTE : content
    await ctx.db.patch(messageId, {
      content: finalContent,
      ...(thinking !== undefined && { thinking }),
      ...(thinkingDuration !== undefined && { thinkingDuration }),
      ...(toolCalls !== undefined && { toolCalls }),
      isComplete: true,
    })
    await discardStreamArtifacts(ctx, messageId)
    return { written: true }
  },
})

/**
 * Closes a reply whose action is gone (scheduled when the placeholder is
 * created, after the longest possible action). Keeps the text that was shown,
 * marks it interrupted, and closes it so later writes are no-ops.
 */
export const expireStream = internalMutation({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId)
    if (!message || message.isComplete) {
      await discardStreamArtifacts(ctx, messageId)
      return
    }
    const row = await getStreamRow(ctx, messageId)
    const shown = row ? await readStreamText(ctx, row) : { content: message.content, thinking: message.thinking ?? '' }
    await ctx.db.patch(messageId, {
      content: shown.content + INTERRUPTED_NOTE,
      ...(shown.thinking && { thinking: shown.thinking }),
      isComplete: true,
    })
    await discardStreamArtifacts(ctx, messageId)
  },
})

/** Continues deleting a large stream's segments. */
export const discardStream = internalMutation({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }) => {
    await discardStreamArtifacts(ctx, messageId)
  },
})

// ---------------------------------------------------------------------------
// Reads (public, owner-checked)
// ---------------------------------------------------------------------------

/**
 * The in-progress replies of one of the caller's chats: each row holds only
 * the open tail and segment counts, so this result stays small while text
 * streams. Clients load full segments once each with getStreamSegment.
 */
export const getStreamingMessages = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    await requireOwnedChat(ctx, chatId)
    const rows = await ctx.db
      .query('streamingMessages')
      .withIndex('by_chat', (q) => q.eq('chatId', chatId))
      .collect()
    return rows.map((row) => ({
      messageId: row.messageId,
      contentTail: row.contentTail,
      contentSegments: row.contentSegments,
      thinkingTail: row.thinkingTail,
      thinkingSegments: row.thinkingSegments,
    }))
  },
})

/** One immutable segment of a reply's streamed text (null once the stream is gone). */
export const getStreamSegment = query({
  args: {
    messageId: v.id('messages'),
    kind: v.union(v.literal('content'), v.literal('thinking')),
    index: v.number(),
  },
  handler: async (ctx, { messageId, kind, index }) => {
    await requireUserId(ctx)
    if (!(await ctx.db.get(messageId))) return null
    await requireOwnedMessage(ctx, messageId)
    const segment = await ctx.db
      .query('streamSegments')
      .withIndex('by_message_kind_index', (q) => q.eq('messageId', messageId).eq('kind', kind).eq('index', index))
      .first()
    return segment?.text ?? null
  },
})
