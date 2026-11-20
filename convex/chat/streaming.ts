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

/**
 * When an unfinished reply is treated as orphaned. A reply is written by the
 * action that created its placeholder (default runtime: at most 30 minutes)
 * and possibly by a Node action it starts (at most 10 minutes, started no
 * later than the parent's end). So no live writer can exist 40 minutes after
 * the placeholder; the extra minute is margin. A reply that is still healthy
 * at minute 11, 20 or 39 is never cut off.
 * https://docs.convex.dev/production/state/limits#execution-time-and-scheduling
 */
export const STREAM_EXPIRY_MS = (30 + 10 + 1) * 60 * 1000

/**
 * Read budget of one discard transaction (Convex allows 16 MiB). Text is at
 * most 3 bytes of UTF-8 per UTF-16 unit, so:
 * - a segment (at most SEGMENT_CHARS units) is at most ~12 KB, and
 * - a streaming row (two tails, each under SEGMENT_CHARS units) is at most ~24 KB.
 * 512 segments (~6.2 MB) plus 250 rows (~6 MB) stay well under the limit.
 */
const DISCARD_SEGMENT_BUDGET = 512

/** Message ids per discard job (each may have a ~24 KB streaming row; see above). */
export const MAX_DISCARD_IDS = 250

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
 * Deletes the streaming row and segments of each listed reply, within one
 * segment budget. Returns the ids still left to clean (the first may be
 * partly done). Never schedules anything itself.
 */
const discardWithinBudget = async (ctx: MutationCtx, messageIds: Id<'messages'>[]) => {
  let budget = DISCARD_SEGMENT_BUDGET
  for (let i = 0; i < messageIds.length; i++) {
    const messageId = messageIds[i]
    const row = await getStreamRow(ctx, messageId)
    if (row) await ctx.db.delete(row._id)
    const segments = await ctx.db
      .query('streamSegments')
      .withIndex('by_message_kind_index', (q) => q.eq('messageId', messageId))
      .take(budget + 1)
    const now = segments.slice(0, budget)
    for (const segment of now) {
      await ctx.db.delete(segment._id)
    }
    budget -= now.length
    if (segments.length > now.length || (budget === 0 && i < messageIds.length - 1)) {
      return messageIds.slice(segments.length > now.length ? i : i + 1)
    }
  }
  return []
}

/**
 * Deletes a reply's streaming row and segments. A very large stream continues
 * in one scheduled job, so this stays within transaction limits.
 */
export const discardStreamArtifacts = async (ctx: MutationCtx, messageId: Id<'messages'>) => {
  const left = await discardWithinBudget(ctx, [messageId])
  if (left.length > 0) {
    await ctx.scheduler.runAfter(0, internal.chat.streaming.discardStreams, { messageIds: left })
  }
}

/** Schedules the cleanup of deleted replies' streams: one scheduled call per MAX_DISCARD_IDS ids. */
export const scheduleStreamDiscard = async (ctx: MutationCtx, messageIds: Id<'messages'>[]) => {
  for (let i = 0; i < messageIds.length; i += MAX_DISCARD_IDS) {
    await ctx.scheduler.runAfter(0, internal.chat.streaming.discardStreams, {
      messageIds: messageIds.slice(i, i + MAX_DISCARD_IDS),
    })
  }
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

/**
 * Where to cut a full segment: SEGMENT_CHARS units, or one less so a
 * surrogate pair (an emoji, for example) is never split. Convex rejects
 * strings with unpaired surrogates, and each segment must be valid on its own.
 */
const segmentCut = (text: string) => (isHighSurrogate(text.charCodeAt(SEGMENT_CHARS - 1)) ? SEGMENT_CHARS - 1 : SEGMENT_CHARS)

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

  // The caller's offset must not skip text; overlap from a retried write is ignored.
  // Offsets and lengths count UTF-16 units, like JavaScript string lengths.
  if (offset > length) return { tail, segments, length }
  const skip = length - offset
  // Stored text always ends on a whole code point; never start mid-pair either
  if (skip > 0 && skip < delta.length && isLowSurrogate(delta.charCodeAt(skip))) return { tail, segments, length }
  const fresh = delta.slice(skip)
  tail += fresh
  while (tail.length >= SEGMENT_CHARS) {
    const cut = segmentCut(tail)
    await ctx.db.insert('streamSegments', { messageId: row.messageId, kind, index: segments, text: tail.slice(0, cut) })
    segments++
    tail = tail.slice(cut)
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

/** Deletes the streams of the listed replies within a budget, continuing in one follow-up job. */
export const discardStreams = internalMutation({
  args: { messageIds: v.array(v.id('messages')) },
  handler: async (ctx, { messageIds }) => {
    const left = await discardWithinBudget(ctx, messageIds)
    if (left.length > 0) {
      await ctx.scheduler.runAfter(0, internal.chat.streaming.discardStreams, { messageIds: left })
    }
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
