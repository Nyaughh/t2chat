/**
 * Gapless playback of audio that arrives in pieces (sentences from the
 * on-device model, PCM frames from Gemini). Each piece is scheduled right
 * after the previous one on a shared AudioContext.
 *
 * The context runs at 24 kHz, the rate every engine produces. That matters:
 * when the context runs at the device rate (44.1 or 48 kHz) the browser
 * resamples each AudioBuffer on its own, without the samples on either side,
 * and every boundary between pieces turns into a click (a constant tick, four
 * times a second, on streamed audio). At the source rate there's nothing to
 * resample per piece; the browser converts the finished output once, smoothly.
 */

export const PLAYBACK_SAMPLE_RATE = 24000

let sharedContext: AudioContext | null = null

/** Must be called from a user gesture the first time so audio is allowed. */
export const getAudioContext = () => {
  if (!sharedContext || sharedContext.state === 'closed') {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    try {
      sharedContext = new Ctor({ sampleRate: PLAYBACK_SAMPLE_RATE, latencyHint: 'playback' })
    } catch {
      sharedContext = new Ctor() // very old browsers: device rate
    }
  }
  if (sharedContext.state === 'suspended') void sharedContext.resume()
  return sharedContext
}

export class AudioQueue {
  private ctx: AudioContext
  private gain: GainNode
  /** End of the scheduled audio, in context frames (exact, no float drift). */
  private nextFrame = 0
  private sources = new Set<AudioBufferSourceNode>()
  private finished = false
  private stopped = false
  private idleResolvers: (() => void)[] = []
  /** Fires once, when the first piece actually starts playing. */
  onStart?: () => void
  private started = false

  constructor(ctx: AudioContext = getAudioContext()) {
    this.ctx = ctx
    this.gain = this.ctx.createGain()
    this.gain.connect(this.ctx.destination)
  }

  enqueue(samples: Float32Array, sampleRate: number) {
    if (this.stopped || samples.length === 0) return
    const buffer = this.ctx.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)

    const rate = this.ctx.sampleRate
    // If playback ran dry (or this is the first piece), start a little ahead of now.
    const earliest = Math.ceil((this.ctx.currentTime + 0.05) * rate)
    const startFrame = Math.max(earliest, this.nextFrame)
    source.start(startFrame / rate)
    this.nextFrame = startFrame + Math.round(buffer.duration * rate)

    this.sources.add(source)
    if (!this.started) {
      this.started = true
      const delay = Math.max(0, (startFrame / rate - this.ctx.currentTime) * 1000)
      setTimeout(() => !this.stopped && this.onStart?.(), delay)
    }
    source.onended = () => {
      this.sources.delete(source)
      this.checkIdle()
    }
  }

  /** Seconds of audio scheduled but not yet played. */
  get buffered() {
    return Math.max(0, this.nextFrame / this.ctx.sampleRate - this.ctx.currentTime)
  }

  /** No more audio will be added; done() resolves once everything has played. */
  finish() {
    this.finished = true
    this.checkIdle()
  }

  done() {
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve)
      this.checkIdle()
    })
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    // A 15 ms fade instead of cutting mid-wave, which pops.
    const now = this.ctx.currentTime
    const end = now + 0.015
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(0, end)
    for (const source of this.sources) {
      source.onended = null
      try {
        source.stop(end)
      } catch {
        // already stopped
      }
    }
    this.sources.clear()
    const gain = this.gain
    setTimeout(() => gain.disconnect(), 50)
    this.finished = true
    this.checkIdle()
  }

  private checkIdle() {
    if (!this.finished || this.sources.size > 0) return
    const resolvers = this.idleResolvers
    this.idleResolvers = []
    resolvers.forEach((r) => r())
  }
}

/** Converts little-endian 16-bit PCM bytes to float samples. */
export const pcm16ToFloat32 = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Float32Array(bytes.byteLength >> 1)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return out
}
