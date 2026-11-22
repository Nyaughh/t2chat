/**
 * The on-device voice model (tiny-voca): download, cache, load and synthesis.
 *
 * The file is fetched once with visible progress, checked against a pinned
 * SHA-256, and kept in the Cache API, so later visits find it without asking
 * again. Nothing here runs until the user asks for an on-device voice.
 *
 * createLocalModel() takes its browser pieces (fetch, the cache, the worker)
 * as arguments so unit tests can drive it; the app uses the default instance
 * exported at the bottom.
 */
import type { LocalRequest, LocalResponse } from './local-protocol'

const REVISION = '5fe06641d0afecb3c04bc9faca2cf64d9b2b1600'

export const LOCAL_MODEL = {
  name: 'tiny-voca',
  url: `https://huggingface.co/n4ze3m/tiny-voca/resolve/${REVISION}/gguf/tiny-voca-js.gguf`,
  bytes: 7_988_384,
  sha256: '8436ad1c9b57c3533c925588a1b3563f906079a89c081ac0bec9f31ad6e28653',
} as const

const CACHE_NAME = 't2chat-voice-models-v1'

export type LocalModelState =
  /** Not checked yet. */
  | { state: 'unknown' }
  | { state: 'absent' }
  | { state: 'downloading'; loaded: number; total: number }
  /** Downloaded, not loaded yet. */
  | { state: 'cached' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string }

/** The parts of the Cache API used here. */
export interface ModelCache {
  match(url: string): Promise<Response | undefined>
  put(url: string, response: Response): Promise<void>
  delete(url: string): Promise<boolean>
}

/** The parts of a Worker used here. */
export interface ModelWorker {
  postMessage(message: LocalRequest, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((event: MessageEvent<LocalResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface LocalModelDeps {
  model: { url: string; bytes: number; sha256: string }
  fetch: typeof fetch
  /** Resolves null when the Cache API is unavailable (e.g. some private modes). */
  openCache: () => Promise<ModelCache | null>
  createWorker: () => ModelWorker
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')

const removedError = () => new DOMException('The on-device voice was removed.', 'AbortError')
const cancelledError = () => new DOMException('Download cancelled', 'AbortError')

export function createLocalModel(deps: LocalModelDeps) {
  const spec = deps.model

  let modelState: LocalModelState = { state: 'unknown' }
  const listeners = new Set<(state: LocalModelState) => void>()
  const setState = (next: LocalModelState) => {
    modelState = next
    listeners.forEach((listener) => listener(next))
  }

  /**
   * False only when the last download couldn't be saved in the browser, so the
   * model lives in this tab's memory and will be downloaded again next visit.
   */
  let savedInBrowser = true

  /**
   * Bumped by remove(). Async work (a cache check, a download, a load)
   * started under an older epoch is dropped instead of reviving the model.
   */
  let epoch = 0

  /** True when the bytes are exactly the pinned model (size and SHA-256). */
  const isExpectedModel = async (bytes: ArrayBuffer) =>
    bytes.byteLength === spec.bytes && toHex(await crypto.subtle.digest('SHA-256', bytes)) === spec.sha256

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  let checkPromise: Promise<boolean> | null = null

  /** True when the model is in memory or saved in the browser. Never downloads. */
  const isAvailable = () => {
    if (modelState.state === 'ready' || modelState.state === 'loading' || modelState.state === 'cached') {
      return Promise.resolve(true)
    }
    if (modelState.state === 'downloading') return Promise.resolve(false)
    checkPromise ??= (async () => {
      const started = epoch
      await afterCancelledCleanup()
      const cache = await deps.openCache()
      const hit = !!(cache && (await cache.match(spec.url)))
      if (started !== epoch) return false // removed meanwhile
      if (modelState.state === 'unknown' || modelState.state === 'absent')
        setState(hit ? { state: 'cached' } : { state: 'absent' })
      return hit
    })().finally(() => {
      checkPromise = null
    })
    return checkPromise
  }

  // -------------------------------------------------------------------------
  // Download
  // -------------------------------------------------------------------------

  interface Download {
    /** What callers await: rejects as soon as the download is cancelled. */
    promise: Promise<ArrayBuffer>
    /** Settles when the work, including undoing a late cache write, has finished. */
    settled: Promise<void>
    abort: AbortController
  }
  let download: Download | null = null

  /** Waits for a cancelled download to finish undoing its cache write, so it can't be read meanwhile. */
  const afterCancelledCleanup = async () => {
    if (download?.abort.signal.aborted) await download.settled
  }

  async function fetchModel(signal: AbortSignal) {
    const response = await deps.fetch(spec.url, { signal })
    if (!response.ok || !response.body) throw new Error(`The download failed (HTTP ${response.status}).`)
    const total = Number(response.headers.get('content-length')) || spec.bytes
    const bytes = new Uint8Array(Math.max(total, spec.bytes))
    const reader = response.body.getReader()
    let loaded = 0
    let lastUpdate = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (loaded + value.length > bytes.length) throw new Error('The download was larger than expected.')
      bytes.set(value, loaded)
      loaded += value.length
      const now = performance.now()
      if (now - lastUpdate > 80 && !signal.aborted) {
        lastUpdate = now
        setState({ state: 'downloading', loaded, total })
      }
    }
    const model = bytes.buffer.slice(0, loaded)
    if (!(await isExpectedModel(model))) throw new Error("The downloaded file didn't match the expected model.")
    return model
  }

  /** Downloads (or joins the running download of) the model and saves it. */
  function startDownload() {
    if (download && !download.abort.signal.aborted) return download.promise
    // A cancelled download may still be cleaning up its cache write; start after it.
    const previous = download?.settled
    const abort = new AbortController()
    const started = epoch
    /** Cancel or Remove, at any point up to the end, including while the file is being saved. */
    const cancelled = () => abort.signal.aborted || started !== epoch
    setState({ state: 'downloading', loaded: 0, total: spec.bytes })

    const entry = { abort } as Download
    const work = (async () => {
      let cache: ModelCache | null = null
      let wrote = false
      try {
        await previous
        if (cancelled()) throw cancelledError()
        const model = await fetchModel(abort.signal)
        if (cancelled()) throw cancelledError()

        cache = await deps.openCache()
        if (cancelled()) throw cancelledError()
        if (cache) {
          try {
            await cache.put(
              spec.url,
              new Response(model.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } }),
            )
            wrote = true
          } catch {
            // Storage full or unavailable: still usable in this tab, just not saved.
          }
        }
        // Cancel can land while the write is pending; it still wins.
        if (cancelled()) throw cancelledError()

        savedInBrowser = wrote
        memoryCopy = wrote ? null : model
        setState({ state: 'cached' })
        return model
      } catch (error) {
        if (cancelled()) {
          // Undo a write that finished after Cancel (or Remove).
          if (wrote) await cache?.delete(spec.url).catch(() => false)
          // Only this download's own state: a newer download or Remove has set its own.
          if (download === entry && started === epoch) setState({ state: 'absent' })
          throw started !== epoch ? removedError() : cancelledError()
        }
        // fetch() reports network trouble as a bare TypeError ("Failed to fetch").
        const message =
          error instanceof TypeError
            ? 'The download was interrupted. Check your connection and try again.'
            : error instanceof Error
              ? error.message
              : 'The download failed.'
        if (download === entry) setState({ state: 'error', message })
        throw error
      } finally {
        if (download === entry) download = null
      }
    })()
    entry.settled = work.then(
      () => {},
      () => {},
    )
    // Callers stop waiting the moment Cancel or Remove happens; the cleanup carries on.
    entry.promise = new Promise<ArrayBuffer>((resolve, reject) => {
      work.then(resolve, reject)
      abort.signal.addEventListener('abort', () => reject(started !== epoch ? removedError() : cancelledError()), {
        once: true,
      })
    })
    download = entry
    return entry.promise
  }

  /** Cancels the running download. The UI updates at once; cleanup finishes in the background. */
  const cancelDownload = () => {
    if (!download || download.abort.signal.aborted) return
    download.abort.abort()
    if (modelState.state === 'downloading') setState({ state: 'absent' })
  }

  const removedListeners = new Set<() => void>()

  /**
   * Removes the saved model (Settings → Speech → Remove). Anything in flight is
   * settled, not left hanging: a pending load and any reading reject with an
   * AbortError, so the player stops its audio and goes idle.
   */
  async function remove() {
    epoch++
    // Readings whose audio is already queued have no pending work here; tell the player.
    removedListeners.forEach((listener) => listener())
    cancelDownload()
    const removed = removedError()
    const oldWorker = worker
    worker = null
    workerReady = null
    oldWorker?.terminate()
    pendingInit?.(removed)
    pendingInit = null
    failAll(removed)
    memoryCopy = null
    savedInBrowser = true
    setState({ state: 'absent' })
    const cache = await deps.openCache()
    await cache?.delete(spec.url)
  }

  // -------------------------------------------------------------------------
  // Worker
  // -------------------------------------------------------------------------

  /** Kept only when the cache couldn't save the file. */
  let memoryCopy: ArrayBuffer | null = null
  let worker: ModelWorker | null = null
  let workerReady: Promise<{ sampleRate: number }> | null = null
  /** Rejects the load that is waiting for the worker's 'ready'. */
  let pendingInit: ((error: Error) => void) | null = null

  interface Reading {
    onAudio: (samples: Float32Array) => void
    resolve: () => void
    reject: (error: Error) => void
  }
  const readings = new Map<number, Reading>()

  const failAll = (error: Error) => {
    readings.forEach((reading) => reading.reject(error))
    readings.clear()
  }

  /** The saved model's bytes, checked again (size and SHA-256) before use. */
  async function readSavedModel(): Promise<{ bytes: ArrayBuffer } | { damaged: true } | null> {
    await afterCancelledCleanup()
    const cache = await deps.openCache()
    const response = await cache?.match(spec.url)
    if (response) {
      const bytes = await response.arrayBuffer()
      if (await isExpectedModel(bytes)) return { bytes }
      // Truncated or corrupted in storage: drop it so the next attempt downloads it again.
      await cache?.delete(spec.url)
      if (!memoryCopy) return { damaged: true }
    }
    if (memoryCopy) return { bytes: memoryCopy.slice(0) } // verified when downloaded
    return null
  }

  /**
   * Loads the saved model into the worker. Resolves with the sample rate.
   * Rejects if the model hasn't been downloaded; it never downloads by itself.
   */
  function load() {
    if (workerReady) return workerReady
    const started = epoch
    const promise = (async () => {
      const saved = await readSavedModel()
      if (started !== epoch) throw removedError()
      if (!saved || 'damaged' in saved) {
        setState({ state: 'absent' })
        throw new Error(
          saved
            ? 'The saved on-device voice was damaged, so it was removed. Download it again to use it.'
            : 'The on-device voice needs to be downloaded first.',
        )
      }
      const model = saved.bytes
      setState({ state: 'loading' })
      const own = deps.createWorker()
      worker = own
      return new Promise<{ sampleRate: number }>((resolve, reject) => {
        pendingInit = reject
        const fail = (message: string) => {
          if (worker !== own) return // already removed or replaced
          own.terminate()
          worker = null
          workerReady = null
          pendingInit = null
          setState({ state: 'error', message })
          const error = new Error(message)
          failAll(error)
          reject(error)
        }
        own.onerror = (event) => fail(event.message || 'The voice engine failed to start.')
        own.onmessage = (event) => {
          if (worker !== own) return
          const message = event.data
          switch (message.type) {
            case 'ready':
              pendingInit = null
              setState({ state: 'ready' })
              resolve({ sampleRate: message.sampleRate })
              break
            case 'init-error':
              fail(`The voice model couldn't load (${message.message}).`)
              break
            case 'audio':
              readings.get(message.session)?.onAudio(message.samples)
              break
            case 'done':
              readings.get(message.session)?.resolve()
              readings.delete(message.session)
              break
            case 'error':
              readings.get(message.session)?.reject(new Error(message.message))
              readings.delete(message.session)
              break
          }
        }
        own.postMessage({ type: 'init', model }, [model])
      })
    })()
    workerReady = promise
    // A failed load must not stick: the next call starts over (e.g. after a download).
    promise.catch(() => {
      if (workerReady === promise) workerReady = null
    })
    return promise
  }

  /**
   * Reads the chunks aloud. onAudio gets each sentence as soon as it's made;
   * the promise resolves after the last one.
   */
  function synthesize(
    session: number,
    chunks: string[],
    voice: string,
    onAudio: (samples: Float32Array) => void,
    speed = 1,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (!worker) return reject(new Error('The on-device voice is not loaded.'))
      readings.set(session, { onAudio, resolve, reject })
      worker.postMessage({ type: 'speak', session, chunks, voice, speed })
    })
  }

  function cancel(session: number) {
    worker?.postMessage({ type: 'cancel', session })
    const reading = readings.get(session)
    if (reading) {
      readings.delete(session)
      reading.reject(new DOMException('Stopped', 'AbortError'))
    }
  }

  return {
    getState: () => modelState,
    subscribe(listener: (state: LocalModelState) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    isSavedInBrowser: () => savedInBrowser,
    isAvailable,
    download: startDownload,
    cancelDownload,
    remove,
    onRemoved(listener: () => void) {
      removedListeners.add(listener)
      return () => {
        removedListeners.delete(listener)
      }
    },
    load,
    synthesize,
    cancel,
  }
}

// ---------------------------------------------------------------------------
// The app's instance
// ---------------------------------------------------------------------------

const localModel = createLocalModel({
  model: LOCAL_MODEL,
  fetch: (...args) => fetch(...args),
  openCache: async () => {
    try {
      return typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME)
    } catch {
      return null // e.g. some private-browsing modes
    }
  },
  // Kept as a literal `new Worker(new URL(...))` so the bundler emits the worker chunk.
  createWorker: () =>
    new Worker(new URL('./local.worker.ts', import.meta.url), { type: 'module', name: 'local-tts' }) as ModelWorker,
})

export const getLocalModelState = localModel.getState
export const subscribeLocalModel = localModel.subscribe
/** False when the last download couldn't be saved, so it lasts only for this tab. */
export const isLocalModelSavedInBrowser = localModel.isSavedInBrowser
export const isLocalModelAvailable = localModel.isAvailable
export const downloadLocalModel = localModel.download
export const cancelLocalDownload = localModel.cancelDownload
export const removeLocalModel = localModel.remove
/** Called when the model is removed, so an on-device reading can stop at once. */
export const onLocalModelRemoved = localModel.onRemoved
export const loadLocalModel = localModel.load
export const synthesizeLocal = localModel.synthesize
export const cancelLocal = localModel.cancel
