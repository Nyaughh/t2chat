/// <reference lib="webworker" />
/**
 * Runs tiny-voca in a Web Worker so synthesis never blocks the UI. The page
 * downloads and caches the model file, then hands its bytes over with 'init'.
 */
import { readGGUF, TinyVoca } from './vendor/tiny-voca/tiny-voca.js'
import { fromGGUF } from './vendor/tiny-voca/dizione/engine.js'
import { utterancesOf } from './vendor/tiny-voca/text.js'
import type { LocalRequest, LocalResponse } from './local-protocol'
import { limitAndFade } from './dsp'

declare const self: DedicatedWorkerGlobalScope

const post = (message: LocalResponse, transfer: Transferable[] = []) => self.postMessage(message, transfer)

let voca: TinyVoca | null = null
let phonemizer: Awaited<ReturnType<typeof fromGGUF>> | null = null

/** The session being read. A newer 'speak' or a 'cancel' ends the old one between sentences. */
let active = 0

/** Lets queued messages (cancel, a newer speak) run between sentences. */
const yieldToMessages = () => new Promise((resolve) => setTimeout(resolve, 0))

async function speak({ session, chunks, voice, speed }: Extract<LocalRequest, { type: 'speak' }>) {
  if (!voca || !phonemizer) {
    post({ type: 'error', session, message: 'The voice model is not loaded.' })
    return
  }
  active = session
  const voiceIndex = Math.max(0, voca.voices.indexOf(voice))
  let seed = 0
  for (const chunk of chunks) {
    let utterances: ReturnType<typeof utterancesOf> = []
    try {
      utterances = utterancesOf(chunk, phonemizer, voca.config.max_tokens - 12)
    } catch {
      // A chunk the phonemizer can't handle is skipped rather than ending the reading.
      continue
    }
    for (const { ids, stress } of utterances) {
      await yieldToMessages()
      if (active !== session) return
      try {
        const { audio } = voca.synthesize(ids, stress, { voice: voiceIndex, speed, seed: seed++ })
        // Keep under clipping and fade the edges so sentences never crackle or click.
        const samples = limitAndFade(audio, voca.config.sample_rate)
        post({ type: 'audio', session, samples }, [samples.buffer])
      } catch {
        // Skip a sentence the model rejects (e.g. too long after splitting).
      }
    }
  }
  if (active === session) post({ type: 'done', session })
}

self.onmessage = async (event: MessageEvent<LocalRequest>) => {
  const request = event.data
  switch (request.type) {
    case 'init': {
      if (voca) {
        post({ type: 'ready', sampleRate: voca.config.sample_rate, voices: voca.voices })
        return
      }
      try {
        const file = readGGUF(request.model)
        const model = new TinyVoca(file)
        phonemizer = await fromGGUF(file)
        voca = model
        post({ type: 'ready', sampleRate: model.config.sample_rate, voices: model.voices })
      } catch (error) {
        post({ type: 'init-error', message: error instanceof Error ? error.message : String(error) })
      }
      return
    }
    case 'speak':
      await speak(request)
      return
    case 'cancel':
      if (active === request.session) active = 0
      return
  }
}
