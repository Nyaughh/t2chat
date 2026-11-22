// Read-aloud player: a failing engine must silence its own audio before the
// system-voice fallback starts, and every failure must leave the player idle.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPlayer, TtsError, type DownloadChoice, type PlayerDeps } from '@/lib/tts/player'

const LONG_TEXT = Array.from({ length: 80 }, (_, i) => `This is sentence number ${i + 1} of a long reply.`).join(' ')
const pcm = (seconds: number) => new Uint8Array(Math.round(24000 * 2 * seconds)).fill(1)

/** A stream that sends some PCM, then either ends or fails. */
const pcmStream = (bytes: Uint8Array, fail?: Error) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      if (fail) controller.error(fail)
      else controller.close()
    },
  })

function harness(overrides: Partial<PlayerDeps> = {}, local: Partial<PlayerDeps['local']> = {}) {
  const log: string[] = []
  const errors: { message: string; fellBack: boolean }[] = []
  const queues: { stopped: boolean; enqueued: number }[] = []
  const deps: PlayerDeps = {
    getEngine: () => 'gemini',
    getVoiceFor: () => null,
    defaultLocalVoice: 'M2',
    primeAudio: () => {},
    createQueue: () => {
      const queue = {
        stopped: false,
        enqueued: 0,
        onStart: undefined as (() => void) | undefined,
        enqueue() {
          queue.enqueued++
          log.push('queue.enqueue')
          if (queue.enqueued === 1) queue.onStart?.()
        },
        finish() {},
        done: () => Promise.resolve(),
        stop() {
          queue.stopped = true
          log.push('queue.stop')
        },
      }
      queues.push(queue)
      return queue
    },
    fetch: async () => new Response(pcmStream(pcm(1))),
    speakBrowser: async (text, _voice, _signal, onStart) => {
      log.push(`browser.speak(${text.length})`)
      onStart()
    },
    stopBrowser: () => {},
    reportError: (message, fellBack) => {
      errors.push({ message, fellBack })
      log.push('error')
    },
    ...overrides,
    local: {
      isAvailable: async () => true,
      isDownloading: () => false,
      askDownload: async () => 'dismiss',
      download: async () => {},
      load: async () => ({ sampleRate: 24000 }),
      synthesize: async (_s, _c, _v, onAudio) => onAudio(new Float32Array(2400)),
      cancel: () => {},
      ...local,
    },
  }
  const player = createPlayer(deps)
  const states: string[] = []
  player.subscribe((s) => states.push(s.status))
  return { player, log, errors, queues, states }
}

test('a Gemini piece that fails after earlier audio stops that audio before the system voice starts', async () => {
  let call = 0
  const h = harness({
    fetch: async () => {
      call++
      if (call === 1) return new Response(pcmStream(pcm(1))) // first piece plays
      return Response.json({ error: 'Gemini voices are busy right now.' }, { status: 429 })
    },
  })
  let ended = 0
  await h.player.speak(LONG_TEXT, { plain: true, onEnd: () => ended++ })

  assert.equal(call, 2, 'the reply was long enough for two requests')
  assert.ok(h.queues[0].enqueued > 0, 'the first piece was scheduled')
  assert.ok(h.queues[0].stopped, 'its audio was stopped')
  const stopAt = h.log.indexOf('queue.stop')
  const browserAt = h.log.findIndex((entry) => entry.startsWith('browser.speak'))
  assert.ok(stopAt >= 0 && browserAt > stopAt, `queue stopped before the fallback: ${h.log.join(', ')}`)
  assert.deepEqual(h.errors, [{ message: 'Gemini voices are busy right now.', fellBack: true }])
  assert.equal(ended, 1, 'onEnd runs once, after the fallback reading')
  assert.equal(h.player.getState().status, 'idle')
})

test('a stream that breaks mid-read falls back to the system voice', async () => {
  const h = harness({ fetch: async () => new Response(pcmStream(pcm(1), new TypeError('network error'))) })
  await h.player.speak('Hello there. This will break halfway.', { plain: true })
  assert.ok(h.queues[0].stopped)
  assert.deepEqual(h.errors, [{ message: 'Gemini voices stopped responding.', fellBack: true }])
  assert.ok(h.log.some((entry) => entry.startsWith('browser.speak')))
  assert.equal(h.player.getState().status, 'idle')
})

test('a request that never connects falls back to the system voice', async () => {
  const h = harness({
    fetch: async () => {
      throw new TypeError('Failed to fetch')
    },
  })
  await h.player.speak('Hello there.', { plain: true })
  assert.deepEqual(h.errors, [{ message: 'Gemini voices stopped responding.', fellBack: true }])
  assert.ok(h.log.some((entry) => entry.startsWith('browser.speak')))
  assert.equal(h.player.getState().status, 'idle')
})

test('if audio output cannot start, the system voice reads it and nothing stays loading', async () => {
  const h = harness({
    primeAudio: () => {
      throw new Error('AudioContext blocked')
    },
  })
  await h.player.speak('Hello there.', { plain: true })
  assert.ok(h.log.some((entry) => entry.startsWith('browser.speak')))
  assert.equal(h.errors[0]?.fellBack, true)
  assert.equal(h.player.getState().status, 'idle')
  assert.ok(h.states.includes('loading') && h.states.at(-1) === 'idle')
})

test('stopping mid-stream silences the audio with no error and no fallback', async () => {
  const h = harness({
    fetch: async (_url, init) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(pcm(1))
            init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
          },
        }),
      ),
  })
  const reading = h.player.speak('Hello there.', { plain: true })
  await new Promise((resolve) => setTimeout(resolve, 10))
  h.player.stop()
  await reading
  assert.ok(h.queues[0].stopped)
  assert.deepEqual(h.errors, [])
  assert.ok(!h.log.some((entry) => entry.startsWith('browser.speak')))
  assert.equal(h.player.getState().status, 'idle')
})

test('removing the on-device model mid-reading stops its audio and settles the owner quietly', async () => {
  let ended = 0
  const h = harness(
    { getEngine: () => 'local' },
    {
      synthesize: async (_s, _c, _v, onAudio) => {
        onAudio(new Float32Array(2400))
        throw new DOMException('The on-device voice was removed.', 'AbortError')
      },
    },
  )
  await h.player.speak('Hello there.', { plain: true, onEnd: () => ended++ })
  assert.ok(h.queues[0].stopped)
  assert.deepEqual(h.errors, [])
  assert.equal(ended, 0)
  assert.equal(h.player.getState().status, 'idle')
})

test('a custom download prompt is used, and is withdrawn when the reading is stopped', async () => {
  const h = harness({ getEngine: () => 'local' }, { isAvailable: async () => false })
  let asked = null as AbortSignal | null
  const reading = h.player.speak('Hello there.', {
    plain: true,
    askDownload: (signal) =>
      new Promise<DownloadChoice>((resolve) => {
        asked = signal
        signal.addEventListener('abort', () => resolve('dismiss'))
      }),
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(asked, 'the prompt passed in options was shown')
  h.player.stop()
  await reading
  assert.equal(asked!.aborted, true, 'stopping withdraws the prompt')
  assert.equal(h.player.getState().status, 'idle')
})

test('choosing the system voice in the download prompt reads with it, without downloading', async () => {
  let downloads = 0
  const h = harness(
    { getEngine: () => 'local' },
    {
      isAvailable: async () => false,
      askDownload: async () => 'browser',
      download: async () => {
        downloads++
      },
    },
  )
  await h.player.speak('Hello there.', { plain: true })
  assert.equal(downloads, 0)
  assert.ok(h.log.some((entry) => entry.startsWith('browser.speak')))
  assert.equal(h.player.getState().status, 'idle')
})

test('errors that a fallback cannot fix are reported without one', async () => {
  const h = harness({
    getEngine: () => 'browser',
    speakBrowser: async () => {
      throw new TtsError("This browser can't read text aloud.", false)
    },
  })
  await h.player.speak('Hello there.', { plain: true })
  assert.deepEqual(h.errors, [{ message: "This browser can't read text aloud.", fellBack: false }])
  assert.equal(h.player.getState().status, 'idle')
})
