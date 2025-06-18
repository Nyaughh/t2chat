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

      const storedVoiceURI = localStorage.getItem('selectedVoiceURI')
      if (storedVoiceURI) {
        setSelectedVoice(storedVoiceURI)
      } else if (availableVoices.length > 0) {
        // Prefer a "Google" voice if available, as they often sound more natural
        const googleVoice = availableVoices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'))
        const preferredVoice = googleVoice || availableVoices.find((v) => v.lang.startsWith('en'))
        if (preferredVoice) {
          setSelectedVoice(preferredVoice.voiceURI)
          localStorage.setItem('selectedVoiceURI', preferredVoice.voiceURI)
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

      if (selectedVoice) {
        const voice = voices.find((v) => v.voiceURI === selectedVoice)
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
    localStorage.setItem('selectedVoiceURI', voiceURI)
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
