// Read aloud: markdown cleanup, chunking, PCM decoding and the click/clip guard.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkForSpeech, markdownToSpeech } from '@/lib/tts/text'
import { pcm16ToFloat32 } from '@/lib/tts/audio-queue'
import { limitAndFade } from '@/lib/tts/dsp'

const MARKDOWN = [
  '## Reversing a list',
  '',
  "Sure! Here's **how** to do it in *Python*.",
  '',
  '```python',
  'nums = [1, 2, 3]',
  'nums.reverse()',
  '```',
  '',
  '- Use `list.reverse()` to reverse in place',
  '- Use slicing for a copy',
  '',
  'See [the docs](https://docs.python.org) e.g. for details. Dr. Smith agrees.',
].join('\n')

test('markdownToSpeech keeps the words and drops the markup', () => {
  const speech = markdownToSpeech(MARKDOWN)
  assert.match(speech, /^Reversing a list\./, 'a heading becomes its own sentence')
  assert.match(speech, /Here's how to do it in Python\./)
  assert.ok(!/[*#`[\]]/.test(speech), 'no markdown symbols are read out')
  assert.ok(!speech.includes('http'), 'link targets are not read out')
  assert.ok(!speech.includes('nums = ['), 'code is summarized, not read')
  assert.match(speech, /Python code block/)
  assert.match(
    speech,
    /Use list\.reverse\(\) to reverse in place\. Use slicing for a copy\./,
    'list items become sentences',
  )
})

test('chunkForSpeech splits on sentences, never inside one', () => {
  const speech = markdownToSpeech(MARKDOWN)
  const chunks = chunkForSpeech(speech, { first: 40, rest: 80 })
  assert.ok(chunks.length > 1)
  assert.ok(chunks[0].length <= 40, 'the first chunk is short so audio starts fast')
  for (const chunk of chunks) assert.ok(chunk.length <= 80, `chunk too long: ${chunk}`)
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), speech.replace(/\s+/g, ' '), 'nothing is lost or reordered')
  assert.ok(
    chunks.some((c) => c.includes('list.reverse()')),
    '"list.reverse()" is not split at its dot',
  )
  assert.ok(
    chunks.some((c) => c.includes('e.g. for details')),
    'no split after "e.g."',
  )
  assert.ok(
    chunks.some((c) => c.includes('Dr. Smith')),
    'no split after "Dr."',
  )
})

test('chunkForSpeech wraps an over-long sentence at a comma or space', () => {
  const long = `${'word, '.repeat(60)}end.`
  const chunks = chunkForSpeech(long, { first: 100, rest: 100 })
  assert.ok(chunks.length > 1)
  for (const chunk of chunks) assert.ok(chunk.length <= 100)
})

test('chunkForSpeech cuts an unbroken run exactly at the limit (the /api/tts cap)', () => {
  const token = 'x'.repeat(3010)
  const chunks = chunkForSpeech(token, { first: 3000, rest: 3000 })
  assert.deepEqual(
    chunks.map((c) => c.length),
    [3000, 10],
  )
  assert.equal(chunks.join(''), token)

  const mixed = `Intro words ${'y'.repeat(6500)} outro.`
  for (const chunk of chunkForSpeech(mixed, { first: 3000, rest: 3000 }))
    assert.ok(chunk.length <= 3000, `${chunk.length}`)
})

test('pcm16ToFloat32 decodes little-endian 16-bit PCM', () => {
  const bytes = new Uint8Array([0x00, 0x80, 0xff, 0x7f, 0x01, 0x00, 0x00, 0x00])
  assert.deepEqual(Array.from(pcm16ToFloat32(bytes)), [-1, 32767 / 32768, 1 / 32768, 0])
})

test('pcm16ToFloat32 respects the view offset and ignores a trailing odd byte', () => {
  const backing = new Uint8Array([0xaa, 0x00, 0x40, 0x99])
  assert.deepEqual(Array.from(pcm16ToFloat32(backing.subarray(1, 4))), [0x4000 / 32768])
})

test('limitAndFade keeps a loud sentence under clipping', () => {
  const rate = 24000
  const audio = new Float32Array(rate).map((_, i) => 1.4 * Math.sin((2 * Math.PI * 220 * i) / rate))
  const out = limitAndFade(audio, rate)
  const peak = out.reduce((top, x) => Math.max(top, Math.abs(x)), 0)
  assert.ok(peak <= 0.99 + 1e-6, `peak ${peak}`)
  assert.ok(peak > 0.98, 'it is scaled down, not squashed')
})

test('limitAndFade fades the edges so sentences do not click, and leaves quiet audio alone', () => {
  const rate = 24000
  const audio = new Float32Array(rate).fill(0.5)
  const out = limitAndFade(audio, rate)
  assert.equal(out[0], 0)
  assert.equal(out[out.length - 1], 0)
  assert.ok(out[48] > 0 && out[48] < 0.5, 'ramping up during the first 4 ms')
  assert.equal(out[rate / 2], 0.5, 'the middle is untouched')
  assert.equal(audio[0], 0.5, 'the input is not modified')
})
