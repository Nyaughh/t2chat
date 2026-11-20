import type { ModelMessage } from 'ai'
import { v4 as uuidv4 } from 'uuid'
import type { DBMessage } from './dexie'
import { parseDataStream } from './stream-parser'

// One streaming loop for every guest (signed-out) reply: new message, retry and
// edit. The live text goes to the UI through `onUpdate` on every chunk, and to
// IndexedDB at most once per `persistIntervalMs`, plus once at the end. Older
// code awaited an IndexedDB write on every chunk (audit P2).

export const STOPPED_NOTE = '\n\n*Generation was stopped by user.*'
export const GUEST_PERSIST_INTERVAL_MS = 250

export interface GuestMessageStore {
  add(message: DBMessage): Promise<unknown>
  update(id: string, changes: Partial<Pick<DBMessage, 'content' | 'thinking' | 'thinkingDuration'>>): Promise<unknown>
  delete(id: string): Promise<unknown>
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
  persistIntervalMs?: number
  fetchImpl?: typeof fetch
  now?: () => number
  createId?: () => string
}

export type GuestReplyStatus = 'complete' | 'stopped' | 'empty'

export interface GuestReplyResult {
  /** Id of the assistant message, or null if none was kept. */
  messageId: string | null
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
    persistIntervalMs = GUEST_PERSIST_INTERVAL_MS,
    fetchImpl = fetch,
    now = Date.now,
    createId = uuidv4,
  } = options

  let response: Response
  try {
    response = await fetchImpl('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, data: { modelId } }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) return { messageId: null, status: 'stopped' }
    throw error
  }

  if (!response.body) throw new Error('No response body')

  const id = createId()
  await store.add({
    id,
    conversationId,
    content: '',
    role: 'assistant',
    createdAt: new Date(),
    model: modelId,
    parts: [],
  })

  let content = ''
  let thinking = ''
  let thinkingDuration: number | undefined
  let streamError: string | undefined
  let dirty = false
  let lastPersist = now()

  const snapshot = (): GuestStreamSnapshot => ({
    id,
    content,
    thinking: thinking || undefined,
    thinkingDuration,
  })

  const persist = async () => {
    dirty = false
    lastPersist = now()
    await store.update(id, { content, thinking: thinking || undefined, thinkingDuration })
  }

  try {
    for await (const chunk of parseDataStream(response.body)) {
      if (signal.aborted) break
      if (chunk.type === 'text') {
        content += chunk.value
        dirty = true
      } else if (chunk.type === 'reasoning') {
        thinking += chunk.value
        dirty = true
      } else if (chunk.type === 'finish') {
        thinkingDuration = chunk.value?.thinkingDuration
        dirty = true
      } else if (chunk.type === 'error') {
        streamError = typeof chunk.value === 'string' ? chunk.value : 'An error occurred while getting the response.'
        continue
      } else {
        continue
      }
      onUpdate?.(snapshot())
      if (dirty && now() - lastPersist >= persistIntervalMs) await persist()
    }
  } catch (error) {
    if (!signal.aborted) {
      // Keep what already arrived, then let the caller report the error.
      if (content.trim()) await persist().catch(() => undefined)
      else await store.delete(id).catch(() => undefined)
      throw error
    }
  }

  if (signal.aborted) {
    content += STOPPED_NOTE
    onUpdate?.(snapshot())
    await persist()
    return { messageId: id, status: 'stopped', error: streamError }
  }

  if (!content.trim()) {
    await store.delete(id)
    return { messageId: null, status: 'empty', error: streamError }
  }

  await persist()
  onUpdate?.(snapshot())
  return { messageId: id, status: 'complete', error: streamError }
}
