import type { ModelMessage } from 'ai'
import { v4 as uuidv4 } from 'uuid'
import type { DBMessage } from './dexie'
import { parseDataStream } from './stream-parser'
import { REPLY_LEASE_RENEW_MS } from './local-data-policy'

// One streaming loop for every guest (signed-out) reply: new message, retry and
// edit. The live text goes to the UI through `onUpdate` on every chunk. It is
// saved to IndexedDB at most once per `persistIntervalMs`: on a later chunk, or
// by a trailing timer if the stream stalls, on `flush()`, and once at the end.
// Older code awaited an IndexedDB write on every chunk (audit P2).

export const STOPPED_NOTE = '\n\n*Generation was stopped by user.*'
/** Appended when the reply was cut short because the guest signed in and the chat was claimed. */
export const CLAIMED_NOTE = '\n\n*Generation stopped because you signed in.*'
export const GUEST_PERSIST_INTERVAL_MS = 250

export type GuestMessageChanges = Partial<Pick<DBMessage, 'content' | 'thinking' | 'thinkingDuration'>>

/**
 * Result of a guest write:
 * - `ok`: written.
 * - `claimed`: the chat still exists but a signed-in user now owns it (the
 *   guest signed in, maybe in another tab). Nothing was written.
 * - `gone`: the message or its chat was deleted (wiped). Nothing was written.
 */
export type GuestWriteResult = 'ok' | 'claimed' | 'gone'

/** Where guest replies are stored. Every write re-checks the chat's state. */
export interface GuestMessageStore {
  /** Resolves to false (nothing written) unless the chat exists and is an unowned guest chat. */
  add(message: DBMessage): Promise<boolean>
  update(id: string, changes: GuestMessageChanges): Promise<GuestWriteResult>
  /**
   * One last write into a chat that was claimed while its reply was running,
   * so the text already shown is kept for import. Never recreates a message or
   * chat that was deleted. Resolves to false if nothing was written.
   */
  saveClaimed(id: string, changes: GuestMessageChanges): Promise<boolean>
  delete(id: string): Promise<unknown>
  /**
   * `add` also takes a reply lease on the chat and every `ok` update renews
   * it (see local-data-policy.ts), so the chat isn't imported while this
   * reply's text is only in memory. Released after the reply's last write.
   */
  releaseLease(conversationId: string, messageId: string): Promise<unknown>
}

export interface GuestStreamSnapshot {
  id: string
  content: string
  thinking?: string
  thinkingDuration?: number
}

export interface StreamGuestReplyOptions {
  conversationId: string
  history: ModelMessage[]
  modelId: string
  signal: AbortSignal
  store: GuestMessageStore
  onUpdate?: (snapshot: GuestStreamSnapshot) => void
  /** Receives a function that saves any buffered text right away. */
  onFlushReady?: (flush: () => Promise<void>) => void
  persistIntervalMs?: number
  fetchImpl?: typeof fetch
  now?: () => number
  createId?: () => string
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export type GuestReplyStatus = 'complete' | 'stopped' | 'empty' | 'claimed' | 'rejected'

export interface GuestReplyResult {
  /** Id of the assistant message, or null if none was kept. */
  messageId: string | null
  /**
   * - `claimed`: the chat was claimed by a user who signed in; the text received
   *   so far was saved into it and the reply stopped.
   * - `rejected`: the chat was deleted, or claimed before any reply was written;
   *   nothing more was written.
   */
  status: GuestReplyStatus
  /** Error text the server sent in the stream, if any. */
  error?: string
}

/** Map stored messages to the history format `/api/chat` expects. */
export const toModelHistory = (messages: ReadonlyArray<{ role: string; content: unknown }>): ModelMessage[] =>
  messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : '',
  }))

export async function streamGuestReply(options: StreamGuestReplyOptions): Promise<GuestReplyResult> {
  const {
    conversationId,
    history,
    modelId,
    signal,
    store,
    onUpdate,
    onFlushReady,
    persistIntervalMs = GUEST_PERSIST_INTERVAL_MS,
    fetchImpl = fetch,
    now = Date.now,
    createId = uuidv4,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options

  // Aborted by the caller (user pressed stop) or by us (write refused).
  const internal = new AbortController()
  const onCallerAbort = () => internal.abort()
  if (signal.aborted) internal.abort()
  else signal.addEventListener('abort', onCallerAbort, { once: true })
  // Set once a write is refused; no further writes happen after that.
  let refused: null | 'claimed' | 'gone' = null
  let completed = false

  try {
    let response: Response
    try {
      response = await fetchImpl('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, data: { modelId } }),
        signal: internal.signal,
      })
    } catch (error) {
      if (signal.aborted) return { messageId: null, status: 'stopped' }
      throw error
    }

    if (!response.body) throw new Error('No response body')

    const id = createId()
    const added = await store.add({
      id,
      conversationId,
      content: '',
      role: 'assistant',
      createdAt: new Date(),
      model: modelId,
      parts: [],
    })
    if (!added) {
      // The chat was removed or claimed while the request was in flight.
      internal.abort()
      return { messageId: null, status: 'rejected' }
    }

    // Writes are chained so they land in order.
    let writes: Promise<unknown> = Promise.resolve()
    const writesSettled = () => writes.catch(() => undefined)

    let leaseTimer: unknown = null
    try {

      let content = ''
      let thinking = ''
      let thinkingDuration: number | undefined
      let streamError: string | undefined
      let dirty = false
      let lastPersist = now()
      let timer: unknown = null

      const snapshot = (): GuestStreamSnapshot => ({
        id,
        content,
        thinking: thinking || undefined,
        thinkingDuration,
      })

      const cancelTimer = () => {
        if (timer !== null) clearTimer(timer)
        timer = null
      }

      const persist = (): Promise<void> => {
        cancelTimer()
        if (refused) return Promise.resolve()
        dirty = false
        lastPersist = now()
        const changes = { content, thinking: thinking || undefined, thinkingDuration }
        const write = writes.then(async () => {
          if (refused) return
          const result = await store.update(id, changes)
          if (result === 'ok') return
          refused = result
          internal.abort()
          if (result === 'claimed') {
            // The guest signed in and the chat survived for import: keep
            // everything received so far (what was on screen), then stop.
            if (!completed) content += CLAIMED_NOTE
            dirty = false
            await store.saveClaimed(id, { content, thinking: thinking || undefined, thinkingDuration })
            onUpdate?.(snapshot())
          }
        })
        writes = write.catch(() => undefined)
        return write
      }

      const flush = () => (dirty ? persist() : writes.then(() => undefined))
      onFlushReady?.(flush)

      // Heartbeat: a regular checkpoint while the reply runs, also during
      // stalls. It renews the lease, and if the chat was claimed or wiped it
      // settles the reply through the same path as any other refused write,
      // without waiting for another chunk.
      const heartbeat = () => {
        leaseTimer = setTimer(() => {
          leaseTimer = null
          void persist().catch(() => undefined)
          if (!refused) heartbeat()
        }, REPLY_LEASE_RENEW_MS)
      }
      heartbeat()

      const schedule = () => {
        if (timer !== null || !dirty) return
        const wait = Math.max(0, persistIntervalMs - (now() - lastPersist))
        timer = setTimer(() => {
          timer = null
          if (dirty) void persist().catch(() => undefined)
        }, wait)
      }

      try {
        for await (const chunk of parseDataStream(response.body)) {
          if (internal.signal.aborted) break
          if (chunk.type === 'text') {
            content += chunk.value
          } else if (chunk.type === 'reasoning') {
            thinking += chunk.value
          } else if (chunk.type === 'finish') {
            thinkingDuration = chunk.value?.thinkingDuration
          } else if (chunk.type === 'error') {
            streamError = typeof chunk.value === 'string' ? chunk.value : 'An error occurred while getting the response.'
            continue
          } else {
            continue
          }
          dirty = true
          onUpdate?.(snapshot())
          if (now() - lastPersist >= persistIntervalMs) await persist()
          else schedule()
        }
      } catch (error) {
        if (!internal.signal.aborted) {
          // Keep everything that already arrived (text or reasoning), then let
          // the caller report the error.
          cancelTimer()
          if (content.trim() || thinking.trim()) await persist().catch(() => undefined)
          else await store.delete(id).catch(() => undefined)
          throw error
        }
      }
      cancelTimer()

      const refusedResult = async (): Promise<GuestReplyResult> => {
        await writes
        return refused === 'claimed'
          ? { messageId: id, status: 'claimed', error: streamError }
          : { messageId: null, status: 'rejected', error: streamError }
      }
      if (refused) return refusedResult()

      if (signal.aborted) {
        content += STOPPED_NOTE
        onUpdate?.(snapshot())
        await persist()
        return refused ? refusedResult() : { messageId: id, status: 'stopped', error: streamError }
      }

      if (!content.trim() && !thinking.trim()) {
        await writes
        await store.delete(id)
        return { messageId: null, status: 'empty', error: streamError }
      }

      completed = true
      await persist()
      if (refused) return refusedResult()
      onUpdate?.(snapshot())
      return { messageId: id, status: 'complete', error: streamError }
    } finally {
      // Release the lease only once the last write has landed, so the stored
      // text is final before the chat can be imported or wiped.
      if (leaseTimer !== null) clearTimer(leaseTimer)
      leaseTimer = null
      await writesSettled()
      await store.releaseLease(conversationId, id).catch(() => undefined)
    }
  } finally {
    signal.removeEventListener('abort', onCallerAbort)
  }
}

// ---------------------------------------------------------------------------
// Guest replies outlive the component that started them: the first guest send
// starts on the home page, which unmounts when the app navigates to the new
// chat. A module-level registry owns running replies, keyed by conversation,
// so the next page sees its chat's live text and can stop it, other chats are
// unaffected, and no callbacks go to unmounted hooks.

export interface GuestReplyView {
  /** True while a reply is being generated in this conversation. */
  streaming: boolean
  /** Latest text of the running reply. */
  snapshot: GuestStreamSnapshot | null
}

export interface GuestReplyRegistry {
  subscribe(listener: () => void): () => void
  /**
   * Running replies by conversation. A new Map object on every change. An entry
   * is removed as soon as its reply ends and its last write has finished, so
   * nothing (text, flush closure) is kept after that.
   */
  getSnapshot(): ReadonlyMap<string, GuestReplyView>
  /** Start a reply. A reply still running in the same conversation is stopped first. */
  run(args: { conversationId: string; history: ModelMessage[]; modelId: string }): Promise<GuestReplyResult>
  /** Abort the reply running in `conversationId`. Resolves to false if none was running there. */
  stop(conversationId: string): boolean
  /** Save buffered text now: of one conversation's reply, or of all running replies. */
  flush(conversationId?: string): Promise<void>
}

const EMPTY_VIEW: ReadonlyMap<string, GuestReplyView> = new Map()

export function createGuestReplyRegistry(
  deps: Pick<
    StreamGuestReplyOptions,
    'store' | 'fetchImpl' | 'persistIntervalMs' | 'now' | 'createId' | 'setTimer' | 'clearTimer'
  >,
): GuestReplyRegistry {
  type Entry = {
    controller: AbortController
    streaming: boolean
    snapshot: GuestStreamSnapshot | null
    flush?: () => Promise<void>
  }
  // The running entry per conversation.
  const entries = new Map<string, Entry>()
  let view = EMPTY_VIEW
  const listeners = new Set<() => void>()

  const emit = () => {
    const next = new Map<string, GuestReplyView>()
    for (const [conversationId, entry] of entries) {
      next.set(conversationId, { streaming: entry.streaming, snapshot: entry.snapshot })
    }
    view = next
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => view,
    async run({ conversationId, history, modelId }) {
      const previous = entries.get(conversationId)
      if (previous?.streaming) previous.controller.abort()

      const entry: Entry = { controller: new AbortController(), streaming: true, snapshot: null }
      entries.set(conversationId, entry)
      emit()
      const isCurrent = () => entries.get(conversationId) === entry
      try {
        return await streamGuestReply({
          ...deps,
          conversationId,
          history,
          modelId,
          signal: entry.controller.signal,
          onUpdate: (snapshot) => {
            entry.snapshot = snapshot
            if (isCurrent()) emit()
          },
          onFlushReady: (flush) => {
            entry.flush = flush
          },
        })
      } finally {
        // streamGuestReply has awaited its last write by now.
        entry.streaming = false
        entry.flush = undefined
        if (isCurrent()) {
          entries.delete(conversationId)
          emit()
        }
      }
    },
    stop(conversationId) {
      const entry = entries.get(conversationId)
      if (!entry?.streaming) return false
      entry.controller.abort()
      return true
    },
    async flush(conversationId) {
      const targets =
        conversationId === undefined ? [...entries.values()] : [entries.get(conversationId)].filter(Boolean)
      await Promise.all(
        (targets as Entry[]).filter((e) => e.streaming && e.flush).map((e) => e.flush!().catch(() => undefined)),
      )
    },
  }
}
