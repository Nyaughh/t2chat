import { useState, useEffect, useCallback, useRef } from 'react'

const sanitizeText = (text: string) => {
  // Remove code blocks
  let sanitizedText = text.replace(/```[\s\S]*?```/g, 'a code block is shown here.')
  // Remove inline code
  sanitizedText = sanitizedText.replace(/`[^`]+`/g, '')
  // Remove markdown images
  sanitizedText = sanitizedText.replace(/!\[.*?\]\(.*?\)/g, '')
  // Remove markdown links
  sanitizedText = sanitizedText.replace(/\[(.*?)\]\(.*?\)/g, '$1')
  // Remove bold, italics
  sanitizedText = sanitizedText.replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
  // Remove headings
  sanitizedText = sanitizedText.replace(/^#+\s/gm, '')
  // Remove horizontal rules
  sanitizedText = sanitizedText.replace(/---/g, '')

  return sanitizedText.trim()
}

const VOICE_STORAGE_KEY = 'selectedVoiceURI'

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const isStopped = useRef(false)

  useEffect(() => {
    const handleVoicesChanged = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)

      // Always prioritize Google voices for better quality
      if (availableVoices.length > 0) {
        // First try to find Google US English voices (highest priority)
        const googleUSVoice = availableVoices.find(
          (v) => v.name.includes('Google') && (v.lang === 'en-US' || v.lang.startsWith('en-US')),
        )

        // Then try any Google English voice
        const googleEnglishVoice = availableVoices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'))

        // Fallback to any English voice
        const englishVoice = availableVoices.find((v) => v.lang.startsWith('en'))

        // The voice the user picked in Settings wins whenever this browser still has it;
        // Google voices are only the default when there is no (valid) saved choice.
        const storedVoiceURI = localStorage.getItem(VOICE_STORAGE_KEY)
        const storedVoice = storedVoiceURI ? availableVoices.find((v) => v.voiceURI === storedVoiceURI) : null

        const preferredVoice = storedVoice || googleUSVoice || googleEnglishVoice || englishVoice

        if (preferredVoice) {
          setSelectedVoice(preferredVoice.voiceURI)
          localStorage.setItem(VOICE_STORAGE_KEY, preferredVoice.voiceURI)
        }
      }
    }

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
    // Initial call in case voices are already loaded
    handleVoicesChanged()

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      if (isSpeaking) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSpeaking])

  const stop = useCallback(() => {
    isStopped.current = true
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
    utteranceRef.current = null
  }, [])

  const speak = useCallback(
    (text: string, onEnd: () => void) => {
      // Reset stopped flag when starting new speech
      isStopped.current = false

      if (isSpeaking) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
        onEnd() // Ensure onEnd is called when stopping
        return
      }

      const sanitizedText = sanitizeText(text)
      const utterance = new SpeechSynthesisUtterance(sanitizedText)

      // Read the saved choice at speak time: Settings may have changed it in another
      // instance of this hook (e.g. the settings dialog) since this one mounted.
      const voiceURI = localStorage.getItem(VOICE_STORAGE_KEY) ?? selectedVoice
      if (voiceURI) {
        const voice = voices.find((v) => v.voiceURI === voiceURI)
        if (voice) {
          utterance.voice = voice
        }
      }

      utterance.onstart = () => {
        if (!isStopped.current) {
          setIsSpeaking(true)
        }
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        if (!isStopped.current) {
          onEnd()
        }
      }

      utterance.onerror = () => {
        setIsSpeaking(false)
        if (!isStopped.current) {
          onEnd()
        }
      }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [selectedVoice, voices, isSpeaking],
  )

  const setVoice = (voiceURI: string) => {
    setSelectedVoice(voiceURI)
    localStorage.setItem(VOICE_STORAGE_KEY, voiceURI)
  }

  return {
    voices,
    selectedVoice,
    setVoice,
    speak,
    stop,
    isSpeaking,
  }
}
