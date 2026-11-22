/**
 * The one read-aloud player for the whole app. Every useSpeechSynthesis()
 * instance talks to this singleton, so starting a new reading always stops the
 * previous one (no overlapping voices) and any button can stop it.
 *
 * The logic lives in player.ts; this file plugs in the browser.
 */
import { toast } from 'sonner'
import { AudioQueue, getAudioContext } from './audio-queue'
import {
  cancelLocal,
  getLocalModelState,
  isLocalModelAvailable,
  loadLocalModel,
  onLocalModelRemoved,
  synthesizeLocal,
} from './local-model'
import { chunkForSpeech } from './text'
import { DEFAULT_LOCAL_VOICE, getEngine, getVoiceFor } from './voices'
import { askLocalDownload, startLocalDownload } from './download-toast'
import { createPlayer, TtsError } from './player'

export { TtsError }
export type { DownloadChoice, SpeakOptions, SpeechState, SpeechStatus } from './player'

const hasSpeechSynthesis = () => typeof window !== 'undefined' && !!window.speechSynthesis

function speakWithBrowser(speech: string, voiceURI: string | null, signal: AbortSignal, onStart: () => void) {
  return new Promise<void>((resolve, reject) => {
    if (!hasSpeechSynthesis()) return reject(new TtsError("This browser can't read text aloud.", false))
    const synth = window.speechSynthesis
    const voice = voiceURI ? synth.getVoices().find((v) => v.voiceURI === voiceURI) : undefined
    // Chrome stops long utterances after ~15 s, so speak sentence chunks in sequence.
    const chunks = chunkForSpeech(speech, { first: 220, rest: 220 })
    if (chunks.length === 0) return resolve()
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      if (voice) utterance.voice = voice
      if (index === 0) utterance.onstart = onStart
      if (index === chunks.length - 1) utterance.onend = () => resolve()
      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') return resolve()
        reject(new TtsError(`Your system voice failed (${event.error}).`, false))
      }
      synth.speak(utterance)
    })
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

const player = createPlayer({
  getEngine,
  getVoiceFor,
  defaultLocalVoice: DEFAULT_LOCAL_VOICE,
  primeAudio: () => void getAudioContext(),
  createQueue: () => new AudioQueue(),
  fetch: (...args) => fetch(...args),
  speakBrowser: speakWithBrowser,
  stopBrowser: () => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel()
  },
  local: {
    isAvailable: isLocalModelAvailable,
    isDownloading: () => getLocalModelState().state === 'downloading',
    askDownload: askLocalDownload,
    download: startLocalDownload,
    load: loadLocalModel,
    synthesize: synthesizeLocal,
    cancel: cancelLocal,
  },
  reportError: (message, fellBack) =>
    toast.error(message, {
      id: 'tts-error',
      description: fellBack ? 'Reading it with your system voice instead.' : undefined,
    }),
})

// Removing the on-device model stops a reading that uses it, including audio already queued.
onLocalModelRemoved(() => {
  if (player.getState().engine === 'local') player.stop()
})

export const speak = player.speak
export const stopSpeaking = player.stop
export const getSpeechState = player.getState
export const subscribeSpeech = player.subscribe

/**
 * Called when the pointer reaches a read-aloud button: if the on-device model
 * is saved in the browser, start loading it so the click is faster.
 * Never triggers a download.
 */
export function prewarmSpeech() {
  if (getEngine() !== 'local') return
  const { state } = getLocalModelState()
  if (state !== 'unknown' && state !== 'cached') return
  void isLocalModelAvailable().then((saved) => {
    if (saved) loadLocalModel().catch(() => {})
  })
}
