/** Small audio helpers shared by the voice worker. Dependency-free so they can be unit-tested. */

/**
 * The model can peak above 1.0, which the speakers would hard-clip into a
 * crackle, and a sentence can start or end mid-wave, which clicks. Returns a
 * copy scaled under 0.99 with its first and last 4 ms faded.
 */
export function limitAndFade(audio: Float32Array, sampleRate: number) {
  let peak = 0
  for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]))
  const gain = peak > 0.99 ? 0.99 / peak : 1
  const fade = Math.min(Math.round(sampleRate * 0.004), audio.length >> 1)
  const out = new Float32Array(audio.length)
  for (let i = 0; i < audio.length; i++) {
    const edge = Math.min(i, audio.length - 1 - i)
    out[i] = audio[i] * gain * (edge < fade ? edge / fade : 1)
  }
  return out
}
