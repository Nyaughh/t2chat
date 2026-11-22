/**
 * The read-aloud player: one session at a time, engine selection, the
 * on-device download choice, and fallback to system voices.
 *
 * Browser APIs (AudioContext, fetch, speechSynthesis, the model worker,
 * toasts) are injected, so this module is plain logic that unit tests can
 * drive with fakes. controller.ts wires in the real ones.
 */
import { chunkForSpeech, markdownToSpeech } from './text'
import { GEMINI_SAMPLE_RATE, TTS_MAX_CHARS } from './limits'
import { pcm16ToFloat32 } from './audio-queue'
import type { TtsEngine } from './voices'

export type SpeechStatus = 'idle' | 'loading' | 'speaking'

export interface SpeechState {
  status: SpeechStatus
  /** Who started the current reading (a message id, 'preview:…', ...). */
  ownerId: string | null
  engine: TtsEngine | null
}

export type DownloadChoice = 'download' | 'browser' | 'dismiss'

export interface SpeakOptions {
  ownerId?: string
  /** Called when the reading finishes on its own (not when it is stopped). */
  onEnd?: () => void
  /** Override the saved engine/voice (used by the settings preview). */
  engine?: TtsEngine
  voice?: string
  /** Text is already plain speech (skip markdown cleanup). */
  plain?: boolean
  /**
   * Asks whether to download the on-device model. Defaults to the toast
   * prompt; the settings dialog passes its own, since a modal blocks toasts.
   * Must resolve 'dismiss' when the signal aborts.
   */
  askDownload?: (signal: AbortSignal) => Promise<DownloadChoice>
}

export class TtsError extends Error {
  /** False when a fallback to system voices wouldn't help. */
  readonly fallback: boolean

  // No constructor parameter properties: the unit tests run this file with Node's type stripping.
  constructor(message: string, fallback = true) {
    super(message)
    this.name = 'TtsError'
    this.fallback = fallback
  }
}

export interface PlaybackQueue {
  onStart?: () => void
  enqueue(samples: Float32Array, sampleRate: number): void
  finish(): void
  done(): Promise<void>
  stop(): void
}

export interface PlayerDeps {
  getEngine(): TtsEngine
  getVoiceFor(engine: TtsEngine): string | null
  defaultLocalVoice: string
  /** Creates/resumes audio output. Called inside the click; may throw. */
  primeAudio(): void
  createQueue(): PlaybackQueue
  fetch: typeof fetch
  /** Reads with system voices; resolves when done or when the signal aborts. */
  speakBrowser(text: string, voiceURI: string | null, signal: AbortSignal, onStart: () => void): Promise<void>
  stopBrowser(): void
  local: {
    isAvailable(): Promise<boolean>
    isDownloading(): boolean
    askDownload(signal: AbortSignal): Promise<DownloadChoice>
    download(): Promise<unknown>
    load(): Promise<{ sampleRate: number }>
    synthesize(
      session: number,
      chunks: string[],
      voice: string,
      onAudio: (samples: Float32Array) => void,
    ): Promise<void>
    cancel(session: number): void
  }
  /** Shows a failure; fellBack says the system voice is taking over. */
  reportError(message: string, fellBack: boolean): void
}

export const isAbortError = (error: unknown) =>
  (error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError')

const abortError = () => new DOMException('Stopped', 'AbortError')

const IDLE: SpeechState = { status: 'idle', ownerId: null, engine: null }

interface Session {
  id: number
  abort: AbortController
  queue: PlaybackQueue | null
}

export function createPlayer(deps: PlayerDeps) {
  let state: SpeechState = IDLE
  const listeners = new Set<(s: SpeechState) => void>()
  const setState = (next: SpeechState) => {
    state = next
    listeners.forEach((listener) => listener(state))
  }

  let sessionCounter = 0
  let current: Session | null = null

  /** Silences everything a session started: queued PCM, worker jobs, system speech. */
  const release = (session: Session) => {
    session.abort.abort()
    session.queue?.stop()
    deps.local.cancel(session.id)
    deps.stopBrowser()
  }

  /** Ends the session if it still owns the player. Audio is disposed before ownership is released. */
  const end = (session: Session) => {
    if (current !== session) return false
    release(session)
    current = null
    setState(IDLE)
    return true
  }

  function stop() {
    if (current) end(current)
    else deps.stopBrowser()
    if (state.status !== 'idle') setState(IDLE)
  }

  async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
    stop()

    const speech = options.plain ? text.trim() : markdownToSpeech(text)
    if (!speech) return

    let engine = options.engine ?? deps.getEngine()
    const session: Session = { id: ++sessionCounter, abort: new AbortController(), queue: null }
    current = session
    const isCurrent = () => current === session
    setState({ status: 'loading', ownerId: options.ownerId ?? null, engine })
    const markSpeaking = () => {
      if (isCurrent()) setState({ ...state, status: 'speaking' })
    }

    try {
      // Create/resume the AudioContext while we're still inside the click handler.
      if (engine !== 'browser') {
        try {
          deps.primeAudio()
        } catch {
          throw new TtsError("Audio playback isn't available here.")
        }
      }

      if (engine === 'local' && !(await deps.local.isAvailable())) {
        if (!isCurrent()) return
        // Already downloading (from another click or Settings): just wait for it.
        const ask = options.askDownload ?? deps.local.askDownload
        const choice = deps.local.isDownloading() ? 'download' : await ask(session.abort.signal)
        if (!isCurrent()) return
        if (choice === 'dismiss') {
          end(session)
          return
        }
        if (choice === 'browser') {
          engine = 'browser'
          setState({ ...state, engine })
        } else {
          try {
            await deps.local.download()
          } catch {
            // Cancelled or failed: the download UI explains and offers Retry.
            end(session)
            return
          }
          if (!isCurrent()) return
        }
      }

      const voice = options.engine === engine && options.voice ? options.voice : deps.getVoiceFor(engine)

      if (engine === 'browser') {
        await deps.speakBrowser(speech, voice, session.abort.signal, markSpeaking)
      } else {
        const queue = deps.createQueue()
        session.queue = queue
        queue.onStart = markSpeaking
        if (engine === 'local') await synthesizeOnDevice(session, speech, voice ?? deps.defaultLocalVoice)
        else await synthesizeGemini(session, speech, voice ?? undefined)
        if (!isCurrent()) return
        queue.finish()
        await queue.done()
      }

      if (end(session)) options.onEnd?.()
    } catch (error) {
      // Stopped from outside (another reading, the stop button): nothing to do.
      if (!isCurrent()) return
      // Dispose this session's audio before anything else can play.
      end(session)
      // Stopped from inside (e.g. the on-device model was removed): stay quiet.
      if (isAbortError(error)) return
      const fallback = engine !== 'browser' && !(error instanceof TtsError && !error.fallback)
      deps.reportError(error instanceof TtsError ? error.message : "Couldn't read this message aloud.", fallback)
      if (fallback) return speak(speech, { ...options, plain: true, engine: 'browser', voice: undefined })
      options.onEnd?.()
    }
  }

  async function synthesizeOnDevice(session: Session, speech: string, voice: string) {
    let sampleRate: number
    try {
      ;({ sampleRate } = await deps.local.load())
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new TtsError(error instanceof Error ? error.message : "The on-device voice couldn't load.")
    }
    if (session.abort.signal.aborted) throw abortError()
    // The worker splits these into sentences and sends each one as soon as it's made.
    const chunks = chunkForSpeech(speech, { first: 300, rest: 600 })
    await deps.local.synthesize(session.id, chunks, voice, (samples) => session.queue?.enqueue(samples, sampleRate))
  }

  async function synthesizeGemini(session: Session, speech: string, voice: string | undefined) {
    const { signal } = session.abort
    /** Network and stream failures become TtsErrors (so they fall back); stops stay aborts. */
    const guard = <T>(step: Promise<T>) =>
      step.catch((error: unknown) => {
        if (signal.aborted || isAbortError(error)) throw abortError()
        throw new TtsError('Gemini voices stopped responding.')
      })

    // Long replies are sent in a few large pieces; each streams as it's generated.
    const pieces = chunkForSpeech(speech, { first: TTS_MAX_CHARS, rest: TTS_MAX_CHARS })
    for (const piece of pieces) {
      if (signal.aborted) throw abortError()
      const response = await guard(
        deps.fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: piece, voice }),
          signal,
        }),
      )
      if (!response.ok || !response.body) {
        let message = "Gemini voices aren't available right now."
        try {
          const body = (await response.json()) as { error?: string } | null
          if (body?.error) message = body.error
        } catch {
          // not JSON
        }
        throw new TtsError(message)
      }

      const reader = response.body.getReader()
      let pendingBytes = new Uint8Array(0)
      // Hold back the first 0.5 s so a network hiccup right at the start doesn't
      // stutter, then schedule ~0.25 s at a time.
      const bytesPerSecond = GEMINI_SAMPLE_RATE * 2
      let minBytes = bytesPerSecond * 0.5
      for (;;) {
        const { value, done } = await guard(reader.read())
        if (value?.length) {
          const merged = new Uint8Array(pendingBytes.length + value.length)
          merged.set(pendingBytes)
          merged.set(value, pendingBytes.length)
          pendingBytes = merged
        }
        if (pendingBytes.length >= minBytes || (done && pendingBytes.length > 1)) {
          const usable = pendingBytes.length - (pendingBytes.length % 2)
          session.queue?.enqueue(pcm16ToFloat32(pendingBytes.subarray(0, usable)), GEMINI_SAMPLE_RATE)
          pendingBytes = pendingBytes.slice(usable)
          minBytes = bytesPerSecond * 0.25
        }
        if (done) break
      }
    }
  }

  return {
    speak,
    stop,
    getState: () => state,
    subscribe(listener: (s: SpeechState) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
