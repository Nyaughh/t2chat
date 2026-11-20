// P2: guest streaming must not write to IndexedDB on every chunk, and must not
// lose text at the edges (stall, unmount, network error, wipe mid-stream).
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GUEST_PERSIST_INTERVAL_MS,
  STOPPED_NOTE,
  createGuestReplyRegistry,
  streamGuestReply,
  type GuestMessageStore,
  type GuestStreamSnapshot,
} from '../src/lib/guest-stream'
import type { DBMessage } from '../src/lib/dexie'

const line = (type: string, value: unknown) => `2:${JSON.stringify([{ type, value }])}\n`
const tick = () => new Promise((r) => setTimeout(r, 0))

/** In-memory stand-in for the guarded db.messages store that counts writes. */
function memoryStore() {
  const rows = new Map<string, DBMessage>()
  const counts = { add: 0, update: 0, delete: 0 }
  let writable = true
  const store: GuestMessageStore = {
    async add(message) {
      if (!writable) return false
      counts.add++
      rows.set(message.id, { ...message })
      return true
    },
    async update(id, changes) {
      const row = rows.get(id)
      if (!writable || !row) return false
      counts.update++
      rows.set(id, { ...row, ...changes })
      return true
    },
    async delete(id) {
      counts.delete++
      rows.delete(id)
    },
  }
  return {
    store,
    rows,
    counts,
    /** Simulates the owner wipe / claim: the chat is no longer an unowned guest chat. */
    revoke: () => {
      writable = false
      rows.clear()
    },
  }
}

/** A fake clock that advances `stepMs` on every read, like chunks arriving over time. */
function steppingClock(stepMs: number) {
  let t = 0
  return () => (t += stepMs)
}

/** Manually driven timers. */
function manualTimers() {
  const pending = new Map<number, () => void>()
  let next = 0
  return {
    setTimer: (fn: () => void) => {
      pending.set(++next, fn)
      return next
    },
    clearTimer: (h: unknown) => {
      pending.delete(h as number)
    },
    fireAll: () => {
      const fns = [...pending.values()]
      pending.clear()
      fns.forEach((fn) => fn())
    },
    get size() {
      return pending.size
    },
  }
}

/**
 * A controllable response body: `push` sends a line, `fail` errors the stream,
 * `end` closes it. Honours the request's abort signal like fetch does.
 */
function controllableFetch() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let respond!: () => void
  const responded = new Promise<void>((r) => (respond = r))
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
      },
    })
    init?.signal?.addEventListener('abort', () => {
      try {
        controller.error(new DOMException('The operation was aborted.', 'AbortError'))
      } catch {}
    })
    await responded
    return new Response(body)
  }) as typeof fetch
  return {
    fetchImpl,
    respond: () => respond(),
    push: (l: string) => controller.enqueue(encoder.encode(l)),
    fail: (e: Error) => controller.error(e),
    end: () => controller.close(),
  }
}

function fetchWithLines(lines: string[]): typeof fetch {
  return (async () => {
    let i = 0
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(c) {
          if (i >= lines.length) return c.close()
          c.enqueue(encoder.encode(lines[i++]))
        },
      }),
    )
  }) as typeof fetch
}

const base = { conversationId: 'conv', history: [], modelId: 'model' }
let n = 0
const createId = () => `msg-${++n}`

test('200 text chunks: the UI sees every chunk, IndexedDB gets a handful of writes', async () => {
  const words = Array.from({ length: 200 }, (_, i) => `w${i} `)
  const { store, rows, counts } = memoryStore()
  const updates: GuestStreamSnapshot[] = []
  const timers = manualTimers()

  const result = await streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    onUpdate: (s) => updates.push(s),
    fetchImpl: fetchWithLines([...words.map((w) => line('text', w)), line('finish', { thinkingDuration: 3 })]),
    now: steppingClock(10), // a chunk every ~10 ms, about 2 s in total
    createId,
    ...timers,
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
  assert.equal(timers.size, 0, 'no timer left behind')
})

test('a chunk inside the throttle window is checkpointed by the trailing timer if the stream stalls', async () => {
  const { store, rows, counts } = memoryStore()
  const timers = manualTimers()
  const net = controllableFetch()
  let t = 0
  const done = streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: net.fetchImpl,
    now: () => t,
    createId,
    ...timers,
  })
  net.respond()
  await tick()
  net.push(line('text', 'buffered'))
  await tick()
  const id = [...rows.keys()][0]
  assert.equal(rows.get(id)?.content, '', 'inside the window: not written yet')
  assert.equal(timers.size, 1, 'a trailing checkpoint is scheduled')

  // The stream stalls; the timer fires.
  t += GUEST_PERSIST_INTERVAL_MS
  timers.fireAll()
  await tick()
  assert.equal(rows.get(id)?.content, 'buffered')
  assert.equal(counts.update, 1)

  net.end()
  await done
})

/** fetch stub that opens a new controllable body per call; `calls[i]` drives the i-th request. */
function multiFetch() {
  const encoder = new TextEncoder()
  const calls: Array<{ push: (l: string) => void; end: () => void }> = []
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
      },
    })
    init?.signal?.addEventListener('abort', () => {
      try {
        controller.error(new DOMException('The operation was aborted.', 'AbortError'))
      } catch {}
    })
    calls.push({ push: (l) => controller.enqueue(encoder.encode(l)), end: () => controller.close() })
    return new Response(body)
  }) as typeof fetch
  return { fetchImpl, calls }
}

const contentOf = (rows: Map<string, DBMessage>, conversationId: string) =>
  [...rows.values()].find((m) => m.conversationId === conversationId)?.content

test('home -> new chat: flush on unmount saves buffered text and the reply keeps running for the next page', async () => {
  const { store, rows } = memoryStore()
  const net = multiFetch()
  const registry = createGuestReplyRegistry({ store, fetchImpl: net.fetchImpl, now: () => 0, createId, ...manualTimers() })

  // The home page starts the first guest send for new chat X and subscribes.
  const homeViews: Array<string | undefined> = []
  const unsubscribeHome = registry.subscribe(() => homeViews.push(registry.getSnapshot().get('X')?.snapshot?.content))
  const done = registry.run({ ...base, conversationId: 'X' })
  await tick()
  net.calls[0].push(line('text', 'Hello'))
  await tick()

  // Navigation home -> /chat/X: the home view unmounts and flushes X; the chat view subscribes.
  unsubscribeHome()
  await registry.flush('X')
  assert.equal(contentOf(rows, 'X'), 'Hello', 'flushed on unmount')
  const chatViews: Array<string | undefined> = []
  registry.subscribe(() => chatViews.push(registry.getSnapshot().get('X')?.snapshot?.content))
  assert.equal(registry.getSnapshot().get('X')?.streaming, true, 'the new page sees the running reply')

  net.calls[0].push(line('text', ' world'))
  net.calls[0].end()
  const result = await done
  assert.equal(result.status, 'complete', 'the reply was not cut off by the navigation')
  assert.equal(contentOf(rows, 'X'), 'Hello world')
  assert.ok(chatViews.includes('Hello world'))
  assert.equal(homeViews.includes('Hello world'), false, 'no callbacks reach the unmounted view')
  assert.equal(registry.getSnapshot().get('X')?.streaming, false)
})

test('two chats: an idle chat Y is not streaming, and stop in Y does not cancel X', async () => {
  const { store, rows } = memoryStore()
  const net = multiFetch()
  const registry = createGuestReplyRegistry({ store, fetchImpl: net.fetchImpl, now: () => 0, createId, ...manualTimers() })
  const x = registry.run({ ...base, conversationId: 'X' })
  await tick()
  net.calls[0].push(line('text', 'x text'))
  await tick()

  // The user navigates to idle chat Y.
  assert.equal(registry.getSnapshot().get('Y')?.streaming ?? false, false, 'Y shows Send, not Stop')
  assert.equal(registry.stop('Y'), false, 'nothing to stop in Y')
  assert.equal(registry.getSnapshot().get('X')?.streaming, true, 'X still running')

  net.calls[0].end()
  assert.equal((await x).status, 'complete')
  assert.equal(contentOf(rows, 'X'), 'x text')
})

test('concurrent replies in X and Y are tracked, flushed and stopped independently', async () => {
  const { store, rows } = memoryStore()
  const net = multiFetch()
  const registry = createGuestReplyRegistry({ store, fetchImpl: net.fetchImpl, now: () => 0, createId, ...manualTimers() })
  const x = registry.run({ ...base, conversationId: 'X' })
  const y = registry.run({ ...base, conversationId: 'Y' })
  await tick()
  net.calls[0].push(line('text', 'from X'))
  net.calls[1].push(line('text', 'from Y'))
  await tick()

  await registry.flush('X')
  assert.equal(contentOf(rows, 'X'), 'from X')
  assert.equal(contentOf(rows, 'Y'), '', 'flushing X leaves Y to its own throttle')

  assert.equal(registry.stop('X'), true)
  assert.equal((await x).status, 'stopped')
  assert.equal(contentOf(rows, 'X'), `from X${STOPPED_NOTE}`)
  assert.equal(registry.getSnapshot().get('Y')?.streaming, true, 'stopping X does not touch Y')

  net.calls[1].push(line('text', ' and more'))
  net.calls[1].end()
  assert.equal((await y).status, 'complete')
  assert.equal(contentOf(rows, 'Y'), 'from Y and more')

  // flush() with no id covers every running reply (pagehide).
  await registry.flush()
})

test('a second reply in the same chat stops the first instead of losing track of it', async () => {
  const { store, rows } = memoryStore()
  const net = multiFetch()
  const registry = createGuestReplyRegistry({ store, fetchImpl: net.fetchImpl, now: () => 0, createId, ...manualTimers() })
  const first = registry.run({ ...base, conversationId: 'X' })
  await tick()
  net.calls[0].push(line('text', 'first'))
  await tick()
  const second = registry.run({ ...base, conversationId: 'X' })
  assert.equal((await first).status, 'stopped', 'the first is stopped and saved')
  await tick()
  net.calls[1].push(line('text', 'second'))
  net.calls[1].end()
  assert.equal((await second).status, 'complete')
  const contents = [...rows.values()].map((m) => m.content).sort()
  assert.deepEqual(contents, [`first${STOPPED_NOTE}`, 'second'])
  assert.equal(registry.getSnapshot().get('X')?.snapshot?.content, 'second')
})

test('a network error after only reasoning keeps the reasoning', async () => {
  const { store, rows } = memoryStore()
  const net = controllableFetch()
  const done = streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: net.fetchImpl,
    now: () => 0,
    createId,
    ...manualTimers(),
  })
  net.respond()
  await tick()
  net.push(line('reasoning', 'thinking about it'))
  await tick()
  net.fail(new TypeError('network down'))
  await assert.rejects(done, /network down/)
  const row = [...rows.values()][0]
  assert.equal(row?.thinking, 'thinking about it')
})

test('a network error mid-stream keeps the text received so far and rethrows', async () => {
  const { store, rows } = memoryStore()
  const net = controllableFetch()
  const done = streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: net.fetchImpl,
    now: () => 0,
    createId,
    ...manualTimers(),
  })
  net.respond()
  await tick()
  net.push(line('text', 'partial'))
  await tick()
  net.fail(new TypeError('network down'))
  await assert.rejects(done, /network down/)
  assert.equal([...rows.values()][0]?.content, 'partial')
})

test('a late response after the owner wipe adds no placeholder', async () => {
  const { store, rows, counts, revoke } = memoryStore()
  const net = controllableFetch()
  const done = streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: net.fetchImpl,
    createId,
    ...manualTimers(),
  })
  revoke() // sign-out wipe or claim lands while the request is in flight
  net.respond()
  const result = await done
  assert.equal(result.status, 'rejected')
  assert.equal(rows.size, 0)
  assert.equal(counts.add, 0)
})

test('a wipe mid-stream stops the reply and nothing is written back', async () => {
  const { store, rows, revoke } = memoryStore()
  const net = controllableFetch()
  let t = 0
  const done = streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: net.fetchImpl,
    now: () => (t += GUEST_PERSIST_INTERVAL_MS), // every chunk tries to persist
    createId,
    ...manualTimers(),
  })
  net.respond()
  await tick()
  net.push(line('text', 'one'))
  await tick()
  revoke()
  net.push(line('text', ' two'))
  const result = await done
  assert.equal(result.status, 'rejected')
  assert.equal(rows.size, 0, 'the wiped message is not recreated')
})

test('an empty reply is removed and the stream error is reported', async () => {
  const { store, rows, counts } = memoryStore()
  const result = await streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    fetchImpl: fetchWithLines([line('error', 'Model is unavailable.')]),
    createId,
    ...manualTimers(),
  })
  assert.equal(result.status, 'empty')
  assert.equal(result.messageId, null)
  assert.equal(result.error, 'Model is unavailable.')
  assert.equal(rows.size, 0)
  assert.equal(counts.delete, 1)
})
