// P2: guest streaming must not write to IndexedDB on every chunk.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GUEST_PERSIST_INTERVAL_MS,
  STOPPED_NOTE,
  streamGuestReply,
  type GuestMessageStore,
  type GuestStreamSnapshot,
} from '../src/lib/guest-stream'
import type { DBMessage } from '../src/lib/dexie'

const line = (type: string, value: unknown) => `2:${JSON.stringify([{ type, value }])}\n`

/** In-memory stand-in for db.messages that counts writes. */
function memoryStore() {
  const rows = new Map<string, DBMessage>()
  const counts = { add: 0, update: 0, delete: 0 }
  const store: GuestMessageStore = {
    async add(message) {
      counts.add++
      rows.set(message.id, { ...message })
    },
    async update(id, changes) {
      counts.update++
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...changes })
    },
    async delete(id) {
      counts.delete++
      rows.delete(id)
    },
  }
  return { store, rows, counts }
}

/** A fake clock that advances `stepMs` on every read, like chunks arriving over time. */
function steppingClock(stepMs: number) {
  let t = 0
  return () => (t += stepMs)
}

/** fetch stub returning the given stream lines, optionally pausing before line `pauseAt`. */
function fetchWithLines(lines: string[], opts: { pauseAt?: number; onPause?: () => void } = {}): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    const signal = init?.signal ?? undefined
    let i = 0
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (opts.pauseAt !== undefined && i === opts.pauseAt) {
          opts.onPause?.()
          await new Promise<void>((resolve) => {
            if (signal?.aborted) resolve()
            signal?.addEventListener('abort', () => resolve(), { once: true })
          })
          controller.error(new DOMException('The operation was aborted.', 'AbortError'))
          return
        }
        if (i >= lines.length) return controller.close()
        controller.enqueue(encoder.encode(lines[i++]))
      },
    })
    return new Response(body)
  }) as typeof fetch
}

const base = { conversationId: 'conv', history: [], modelId: 'model' }
let n = 0
const createId = () => `msg-${++n}`

test('200 text chunks: the UI sees every chunk, IndexedDB gets a handful of writes', async () => {
  const words = Array.from({ length: 200 }, (_, i) => `w${i} `)
  const { store, rows, counts } = memoryStore()
  const updates: GuestStreamSnapshot[] = []

  const result = await streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    onUpdate: (s) => updates.push(s),
    fetchImpl: fetchWithLines([...words.map((w) => line('text', w)), line('finish', { thinkingDuration: 3 })]),
    now: steppingClock(10), // a chunk every ~10 ms, about 2 s in total
    createId,
  })

  assert.equal(result.status, 'complete')
  const expected = words.join('')
  assert.equal(rows.get(result.messageId!)?.content, expected)
  assert.equal(rows.get(result.messageId!)?.thinkingDuration, 3)
  assert.equal(updates.at(-1)?.content, expected)
  assert.ok(updates.length >= 200, 'UI gets one update per chunk')
  // Before: one awaited IndexedDB update per chunk (201 writes for this reply).
  // After: at most one per GUEST_PERSIST_INTERVAL_MS, plus the final write.
  const maxWrites = Math.ceil((201 * 10) / GUEST_PERSIST_INTERVAL_MS) + 1
  assert.ok(counts.update <= maxWrites, `expected <= ${maxWrites} writes, got ${counts.update}`)
  assert.equal(counts.add, 1)
})

test('stop mid-stream saves the partial reply with the stopped note', async () => {
  const { store, rows } = memoryStore()
  const controller = new AbortController()
  const result = await streamGuestReply({
    ...base,
    signal: controller.signal,
    store,
    // The user presses stop once "Hello there" is on screen; the server then stalls.
    onUpdate: (s) => {
      if (s.content === 'Hello there') controller.abort()
    },
    fetchImpl: fetchWithLines([line('text', 'Hello '), line('text', 'there'), line('text', ' never')], {
      pauseAt: 2,
    }),
    now: steppingClock(1), // throttle never fires, so only the stop write persists the text
    createId,
  })
  assert.equal(result.status, 'stopped')
  assert.equal(rows.get(result.messageId!)?.content, `Hello there${STOPPED_NOTE}`)
})

test('an empty reply is removed and the stream error is reported', async () => {
  const { store, rows, counts } = memoryStore()
  const result = await streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: fetchWithLines([line('error', 'Model is unavailable.')]),
    createId,
  })
  assert.equal(result.status, 'empty')
  assert.equal(result.messageId, null)
  assert.equal(result.error, 'Model is unavailable.')
  assert.equal(rows.size, 0)
  assert.equal(counts.delete, 1)
})

test('a network error mid-stream keeps the text received so far and rethrows', async () => {
  const { store, rows } = memoryStore()
  const encoder = new TextEncoder()
  let sent = false
  const fetchImpl = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!sent) {
            sent = true
            controller.enqueue(encoder.encode(line('text', 'partial')))
          } else controller.error(new TypeError('network down'))
        },
      }),
    )) as typeof fetch

  await assert.rejects(
    streamGuestReply({ ...base, signal: new AbortController().signal, store, fetchImpl, createId }),
    /network down/,
  )
  assert.equal([...rows.values()][0]?.content, 'partial')
})
