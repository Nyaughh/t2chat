// P2: guest streaming must not write to IndexedDB on every chunk, and must not
// lose text at the edges (stall, unmount, network error, wipe mid-stream).
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLAIMED_NOTE,
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

/**
 * In-memory stand-in for guardedGuestMessageStore that counts writes. The chat
 * is an unowned guest chat until `claim()` (a user signed in and owns it now)
 * or `revoke()` (the chat and its messages were wiped).
 */
function memoryStore() {
  const rows = new Map<string, DBMessage>()
  const counts = { add: 0, update: 0, delete: 0, saveClaimed: 0 }
  let chat: 'guest' | 'claimed' | 'gone' = 'guest'
  const store: GuestMessageStore = {
    async add(message) {
      if (chat !== 'guest') return false
      counts.add++
      rows.set(message.id, { ...message })
      return true
    },
    async update(id, changes) {
      const row = rows.get(id)
      if (chat === 'gone' || !row) return 'gone'
      if (chat === 'claimed') return 'claimed'
      counts.update++
      rows.set(id, { ...row, ...changes })
      return 'ok'
    },
    async saveClaimed(id, changes) {
      const row = rows.get(id)
      if (chat === 'gone' || !row) return false
      counts.saveClaimed++
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
    /** The guest signed in (maybe in another tab) and the chat was claimed; its rows survive. */
    claim: () => {
      chat = 'claimed'
    },
    /** The owner wipe: the chat and its messages are deleted. */
    revoke: () => {
      chat = 'gone'
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
  const calls: Array<{ push: (l: string) => void; end: () => void; fail: (e: Error) => void }> = []
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
    calls.push({
      push: (l) => controller.enqueue(encoder.encode(l)),
      end: () => controller.close(),
      fail: (e) => controller.error(e),
    })
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
  assert.equal(registry.getSnapshot().has('X'), false, 'released once the reply is saved')
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
  assert.equal(registry.getSnapshot().has('X'), false)
})

test('nothing is retained after replies end: completed, stopped, failed and refused entries are released', async () => {
  const { store, revoke } = memoryStore()
  const net = multiFetch()
  const registry = createGuestReplyRegistry({ store, fetchImpl: net.fetchImpl, now: () => 0, createId, ...manualTimers() })

  const done = registry.run({ ...base, conversationId: 'done' })
  const stopped = registry.run({ ...base, conversationId: 'stopped' })
  const failed = registry.run({ ...base, conversationId: 'failed' })
  await tick()
  for (const call of net.calls) call.push(line('text', 'text'))
  await tick()
  assert.deepEqual([...registry.getSnapshot().keys()].sort(), ['done', 'failed', 'stopped'])

  net.calls[0].end()
  registry.stop('stopped')
  net.calls[2].fail(new TypeError('network down'))
  assert.equal((await done).status, 'complete')
  assert.equal((await stopped).status, 'stopped')
  await assert.rejects(failed, /network down/)
  assert.equal(registry.getSnapshot().size, 0)

  // A reply refused after a wipe is released too.
  revoke()
  const refused = registry.run({ ...base, conversationId: 'wiped' })
  await tick()
  assert.equal((await refused).status, 'rejected')
  assert.equal(registry.getSnapshot().size, 0)
})

test('claim mid-reply: the text already shown is kept in the surviving chat for import, then the reply stops', async () => {
  const { store, rows, counts, claim } = memoryStore()
  const net = controllableFetch()
  const timers = manualTimers()
  let t = 0
  const shown: string[] = []
  const done = streamGuestReply({
    ...base,
    signal: new AbortController().signal,
    store,
    onUpdate: (s) => shown.push(s.content),
    fetchImpl: net.fetchImpl,
    now: () => t,
    createId,
    ...timers,
  })
  net.respond()
  await tick()
  net.push(line('text', 'visible'))
  await tick()
  const id = [...rows.keys()][0]
  assert.equal(rows.get(id)?.content, '', 'still inside the throttle window')

  // The same guest signs in (second tab) and the chat is claimed, not wiped.
  claim()
  t += GUEST_PERSIST_INTERVAL_MS
  timers.fireAll()
  const result = await done
  assert.equal(result.status, 'claimed')
  assert.equal(result.messageId, id)
  assert.equal(rows.get(id)?.content, `visible${CLAIMED_NOTE}`, 'the shown partial text survives for import')
  assert.equal(counts.saveClaimed, 1, 'exactly one final write into the claimed chat')
  assert.equal(shown.at(-1), `visible${CLAIMED_NOTE}`)

  // Later chunks write nothing more.
  try {
    net.push(line('text', ' later'))
  } catch {}
  await tick()
  assert.equal(rows.get(id)?.content, `visible${CLAIMED_NOTE}`)
})

test('claim right at completion keeps the full reply without a note', async () => {
  const { store, rows, claim } = memoryStore()
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
  net.push(line('text', 'all of it'))
  await tick()
  claim()
  net.end()
  const result = await done
  assert.equal(result.status, 'claimed')
  assert.equal(rows.get(result.messageId!)?.content, 'all of it')
})

test('wipe vs claim: a wiped chat is never recreated, even by the final claimed write', async () => {
  const { store, rows, counts, revoke } = memoryStore()
  assert.equal(await store.saveClaimed('missing', { content: 'x' }), false)
  revoke()
  assert.equal(await store.update('missing', { content: 'x' }), 'gone')
  assert.equal(rows.size, 0)
  assert.equal(counts.saveClaimed, 0)
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
