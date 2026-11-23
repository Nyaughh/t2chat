'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  getSpeechState,
  speak as speakText,
  stopSpeaking,
  subscribeSpeech,
  type SpeakOptions,
  type SpeechState,
} from '@/lib/tts/controller'
import {
  PREFS_EVENT,
  VOICE_STORAGE_KEY,
  getBrowserVoiceURI,
  getEngine,
  getVoiceFor,
  setEngine as saveEngine,
  setGeminiAvailable,
  setVoiceFor,
  type TtsEngine,
} from '@/lib/tts/voices'

const IDLE_STATE: SpeechState = { status: 'idle', ownerId: null, engine: null }

/** Picks the browser voice used by the "System voices" engine. A saved choice always wins. */
const pickBrowserVoice = (voices: SpeechSynthesisVoice[]) => {
  const stored = getBrowserVoiceURI()
  const storedVoice = stored ? voices.find((v) => v.voiceURI === stored) : undefined
  return (
    storedVoice ??
    voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en-US')) ??
    voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ??
    voices.find((v) => v.lang.startsWith('en'))
  )
}

/** Re-renders when the saved engine/voice changes (in this tab or another). */
function usePrefsVersion() {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener(PREFS_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PREFS_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])
  return version
}

/** Just the shared player's status ('idle' | 'loading' | 'speaking'); cheap to use per message. */
export function useSpeechStatus() {
  return useSyncExternalStore(subscribeSpeech, () => getSpeechState().status, () => 'idle' as const)
}

/**
 * Read-aloud for the whole app. All instances share one player, so only one
 * thing speaks at a time and any instance can stop it. The engine and voice
 * are read from storage at speak time, so a change in Settings applies to
 * every caller immediately.
 */
export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const prefsVersion = usePrefsVersion()
  const speech = useSyncExternalStore(subscribeSpeech, getSpeechState, () => IDLE_STATE)

  // Gemini voices need the user's own saved Gemini key.
  const { isAuthenticated } = useConvexAuth()
  const hasGeminiKey = useQuery(api.api_keys.hasApiKeyForProvider, isAuthenticated ? { provider: 'gemini' } : 'skip')
  const geminiAvailable = isAuthenticated && hasGeminiKey === true
  useEffect(() => setGeminiAvailable(geminiAvailable), [geminiAvailable])

  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) return
    const handleVoicesChanged = () => {
      const available = synth.getVoices()
      setVoices(available)
      const preferred = pickBrowserVoice(available)
      if (preferred) {
        setSelectedVoice(preferred.voiceURI)
        // Like master: a missing or no-longer-available saved voice is replaced by
        // the default. Written directly (no prefs event) so this effect doesn't re-run.
        if (getBrowserVoiceURI() !== preferred.voiceURI) localStorage.setItem(VOICE_STORAGE_KEY, preferred.voiceURI)
      }
    }
    synth.addEventListener('voiceschanged', handleVoicesChanged)
    handleVoicesChanged()
    return () => synth.removeEventListener('voiceschanged', handleVoicesChanged)
  }, [prefsVersion])

  const stop = useCallback(() => stopSpeaking(), [])

  /** Reads text aloud, replacing anything already playing. onEnd runs when it finishes on its own. */
  const speak = useCallback((text: string, onEnd?: () => void, options?: Omit<SpeakOptions, 'onEnd'>) => {
    void speakText(text, { ...options, onEnd })
  }, [])

  /** Sets the system (browser) voice. */
  const setVoice = useCallback((voiceURI: string) => {
    setSelectedVoice(voiceURI)
    setVoiceFor('browser', voiceURI)
  }, [])

  const engine: TtsEngine = typeof window === 'undefined' ? 'local' : getEngine()
  void prefsVersion // engine/voice below are re-read whenever prefs change

  return {
    // System voices (kept for existing callers)
    voices,
    selectedVoice,
    setVoice,
    // Shared player
    speak,
    stop,
    isSpeaking: speech.status !== 'idle',
    status: speech.status,
    speakingId: speech.ownerId,
    // Engine preferences
    engine,
    setEngine: saveEngine,
    engineVoice: getVoiceFor(engine),
    setEngineVoice: setVoiceFor,
    /** Whether the user has a saved Gemini key, which Gemini voices require. */
    geminiAvailable,
  }
}
