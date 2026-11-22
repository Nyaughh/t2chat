// On-device model store: Cancel and Remove must win at every point of a
// download, including while the file is being written to the cache.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalModel, type ModelCache, type ModelWorker } from '@/lib/tts/local-model'

const URL_ = 'https://example.test/model.gguf'
const BYTES = new Uint8Array(4096).map((_, i) => (i * 31 + 7) % 251)

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A Cache API stand-in whose put() can be held open to reproduce a slow write. */
function fakeCache() {
  const entries = new Map<string, Uint8Array>()
  const holds: ReturnType<typeof deferred>[] = []
  let failPut = false
  const cache: ModelCache = {
    async match(url) {
      const bytes = entries.get(url)
      return bytes ? new Response(bytes.slice()) : undefined
    },
    async put(url, response) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      const hold = holds.shift()
      if (hold) await hold.promise
      if (failPut) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      entries.set(url, bytes) // written once put() resolves, like the real thing
    },
    async delete(url) {
      return entries.delete(url)
    },
  }
  return {
    cache,
    entries,
    /** The next put() waits until the returned release() is called. */
    holdNextPut() {
      const hold = deferred()
      holds.push(hold)
      return () => hold.resolve()
    },
    failPuts() {
      failPut = true
    },
  }
}

/** A worker that answers 'ready' to init. */
function fakeWorker(): ModelWorker {
  const worker: ModelWorker = {
    onmessage: null,
    onerror: null,
    terminate() {},
    postMessage(message) {
      if (message.type === 'init')
        queueMicrotask(() =>
          worker.onmessage?.({ data: { type: 'ready', sampleRate: 24000, voices: ['M2'] } } as MessageEvent),
        )
    },
  }
  return worker
}

async function setup() {
  const store = fakeCache()
  let fetches = 0
  const model = createLocalModel({
    model: { url: URL_, bytes: BYTES.length, sha256: await sha256(BYTES) },
    fetch: async () => {
      fetches++
      return new Response(BYTES.slice(), { headers: { 'content-length': String(BYTES.length) } })
    },
    openCache: async () => store.cache,
    createWorker: fakeWorker,
  })
  return { model, store, fetchCount: () => fetches }
}

/** Lets pending microtasks and timers run (fetch, digest, put). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

const isAbort = (error: unknown) => error instanceof Error && error.name === 'AbortError'

test('a normal download is saved, verified and loads', async () => {
  const { model, store } = await setup()
  const bytes = await model.download()
  assert.equal(bytes.byteLength, BYTES.length)
  assert.equal(model.getState().state, 'cached')
  assert.ok(store.entries.has(URL_))
  assert.equal(model.isSavedInBrowser(), true)
  assert.deepEqual(await model.load(), { sampleRate: 24000 })
  assert.equal(model.getState().state, 'ready')
})

test('Cancel while the cache write is pending wins: no entry, no model, and the caller stops waiting at once', async () => {
  const { model, store } = await setup()
  const release = store.holdNextPut()
  const download = model.download()
  let outcome: unknown = 'pending'
  download.then(
    () => (outcome = 'fulfilled'),
    (error) => (outcome = error),
  )
  await settle() // fetched and verified; now blocked inside cache.put()
  assert.equal(model.getState().state, 'downloading')

  model.cancelDownload()
  assert.equal(model.getState().state, 'absent', 'the UI updates immediately')
  await settle()
  assert.ok(isAbort(outcome), `the download rejects before the write finishes (got ${String(outcome)})`)

  release() // the write lands after Cancel
  await settle()
  assert.equal(store.entries.has(URL_), false, 'the late write is undone')
  assert.equal(model.getState().state, 'absent')
  assert.equal(await model.isAvailable(), false)
  await assert.rejects(model.load(), /needs to be downloaded first/, 'no in-memory copy survives either')
})

test('Remove while the cache write is pending wins the same way', async () => {
  const { model, store } = await setup()
  const release = store.holdNextPut()
  const download = model.download()
  const result = download.then(
    () => 'fulfilled',
    (error: Error) => error.message,
  )
  await settle()
  const removing = model.remove()
  assert.equal(await result, 'The on-device voice was removed.')
  release()
  await removing
  await settle()
  assert.equal(store.entries.has(URL_), false)
  assert.equal(model.getState().state, 'absent')
  await assert.rejects(model.load(), /needs to be downloaded first/)
})

test('right after Cancel, an availability check waits for the late write to be undone', async () => {
  const { model, store } = await setup()
  const release = store.holdNextPut()
  model.download().catch(() => {})
  await settle()
  model.cancelDownload()
  const available = model.isAvailable()
  release()
  assert.equal(await available, false, 'it never sees the entry that is about to be deleted')
  assert.equal(store.entries.has(URL_), false)
})

test('a new download after Cancel waits for the old cleanup and is not undone by it', async () => {
  const { model, store, fetchCount } = await setup()
  const releaseOld = store.holdNextPut()
  model.download().catch(() => {})
  await settle()
  model.cancelDownload()

  const again = model.download() // the user presses Download again straight away
  assert.equal(model.getState().state, 'downloading')
  releaseOld()
  await again
  await settle()
  assert.equal(fetchCount(), 2)
  assert.ok(store.entries.has(URL_), 'the second download is saved')
  assert.equal(model.getState().state, 'cached')
})

test('if the browser refuses to save, the model still works for this tab and says so', async () => {
  const { model, store } = await setup()
  store.failPuts()
  await model.download()
  assert.equal(model.getState().state, 'cached')
  assert.equal(model.isSavedInBrowser(), false)
  assert.equal(store.entries.has(URL_), false)
  assert.deepEqual(await model.load(), { sampleRate: 24000 }, 'loads from the in-memory copy')
})

test('a damaged saved file is evicted and reported, and a fresh download then works', async () => {
  const { model, store } = await setup()
  store.entries.set(URL_, BYTES.slice(0, 100)) // truncated in storage
  assert.equal(await model.isAvailable(), true)
  await assert.rejects(model.load(), /damaged, so it was removed/)
  assert.equal(store.entries.has(URL_), false)
  assert.equal(model.getState().state, 'absent')
  await model.download()
  assert.deepEqual(await model.load(), { sampleRate: 24000 })
})

test('Remove settles a reading that is in progress', async () => {
  const { model } = await setup()
  await model.download()
  await model.load()
  let removedCalls = 0
  model.onRemoved(() => removedCalls++)
  const reading = model.synthesize(1, ['Hello.'], 'M2', () => {})
  await model.remove()
  await assert.rejects(reading, (error: Error) => isAbort(error))
  assert.equal(removedCalls, 1)
  await assert.rejects(
    model.synthesize(2, ['Hi.'], 'M2', () => {}),
    /not loaded/,
  )
})
