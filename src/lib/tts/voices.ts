/** Speech engines, their voices, and the persisted read-aloud preferences. */

export type TtsEngine = 'local' | 'gemini' | 'browser'

export interface VoiceOption {
  id: string
  name: string
  description?: string
  /** Shown as a badge: the highest-rated voices. */
  recommended?: boolean
  accent?: 'US' | 'UK'
  gender?: 'Female' | 'Male'
}

export const ENGINES: { id: TtsEngine; name: string; description: string }[] = [
  {
    id: 'local',
    name: 'On-device voice',
    description: 'Runs in your browser after a one-time 8 MB download. Free, private, and works offline.',
  },
  {
    id: 'gemini',
    name: 'Gemini voices (cloud)',
    description: 'Studio-quality voices from Google Gemini. Requires sign-in, and takes a few seconds to start.',
  },
  {
    id: 'browser',
    name: 'System voices',
    description: "Your device's built-in voices. Instant, no download.",
  },
]

/** tiny-voca's two voices. */
export const LOCAL_VOICES: VoiceOption[] = [
  { id: 'M2', name: 'Male', accent: 'US', gender: 'Male' },
  { id: 'F2', name: 'Female', accent: 'US', gender: 'Female' },
]

/** Prebuilt Gemini TTS voices (a curated subset of the 30). */
export const GEMINI_VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore', description: 'Firm' },
  { id: 'Sulafat', name: 'Sulafat', description: 'Warm' },
  { id: 'Achird', name: 'Achird', description: 'Friendly' },
  { id: 'Aoede', name: 'Aoede', description: 'Breezy' },
  { id: 'Puck', name: 'Puck', description: 'Upbeat' },
  { id: 'Charon', name: 'Charon', description: 'Informative' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Bright' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', description: 'Gentle' },
  { id: 'Iapetus', name: 'Iapetus', description: 'Clear' },
  { id: 'Algieba', name: 'Algieba', description: 'Smooth' },
  { id: 'Despina', name: 'Despina', description: 'Smooth' },
  { id: 'Callirrhoe', name: 'Callirrhoe', description: 'Easy-going' },
  { id: 'Sadaltager', name: 'Sadaltager', description: 'Knowledgeable' },
  { id: 'Gacrux', name: 'Gacrux', description: 'Mature' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', description: 'Casual' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Excitable' },
]

export const GEMINI_VOICE_IDS = new Set(GEMINI_VOICES.map((v) => v.id))

export const DEFAULT_ENGINE: TtsEngine = 'local'
export const DEFAULT_LOCAL_VOICE = 'M2'
export const DEFAULT_GEMINI_VOICE = 'Kore'

// Preferences live in localStorage next to the existing browser-voice key, and
// are always read at speak time so every hook instance sees the latest choice.
export const ENGINE_STORAGE_KEY = 'ttsEngine'
export const VOICE_STORAGE_KEY = 'selectedVoiceURI' // browser (speechSynthesis) voice
export const LOCAL_VOICE_STORAGE_KEY = 'ttsVoice.local'
export const GEMINI_VOICE_STORAGE_KEY = 'ttsVoice.gemini'

const read = (key: string) => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: key }))
}

export const PREFS_EVENT = 'tts-prefs-changed'

export const getEngine = (): TtsEngine => {
  const stored = read(ENGINE_STORAGE_KEY)
  return stored === 'local' || stored === 'gemini' || stored === 'browser' ? stored : DEFAULT_ENGINE
}
export const setEngine = (engine: TtsEngine) => write(ENGINE_STORAGE_KEY, engine)

export const getLocalVoice = () => {
  const stored = read(LOCAL_VOICE_STORAGE_KEY)
  return stored && LOCAL_VOICES.some((v) => v.id === stored) ? stored : DEFAULT_LOCAL_VOICE
}
export const getGeminiVoice = () => {
  const stored = read(GEMINI_VOICE_STORAGE_KEY)
  return stored && GEMINI_VOICE_IDS.has(stored) ? stored : DEFAULT_GEMINI_VOICE
}
export const getBrowserVoiceURI = () => read(VOICE_STORAGE_KEY)

export const setVoiceFor = (engine: TtsEngine, voiceId: string) =>
  write(
    engine === 'local' ? LOCAL_VOICE_STORAGE_KEY : engine === 'gemini' ? GEMINI_VOICE_STORAGE_KEY : VOICE_STORAGE_KEY,
    voiceId,
  )

export const getVoiceFor = (engine: TtsEngine) =>
  engine === 'local' ? getLocalVoice() : engine === 'gemini' ? getGeminiVoice() : getBrowserVoiceURI()
