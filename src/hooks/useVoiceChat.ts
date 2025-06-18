import { useState, useEffect, useCallback, useRef } from 'react'
import { useSpeechSynthesis } from './useSpeechSynthesis'

interface VoiceChatState {
  isActive: boolean
  isListening: boolean
  isSpeaking: boolean
  isProcessing: boolean
  currentTranscript: string
  interimTranscript: string
  error: string | null
}

interface VoiceChatOptions {
  autoSpeak?: boolean
  continuousMode?: boolean
  interimResults?: boolean
  language?: string
  silenceDetectionTime?: number
}

export function useVoiceChat(
  onMessageSend: (message: string) => void,
  onResponse: (response: string) => void,
  options: VoiceChatOptions = {},
) {
  const {
    autoSpeak = true,
    continuousMode = true,
    interimResults = true,
    language = 'en-US',
    silenceDetectionTime = 2000,
  } = options

  const { speak, isSpeaking: speechSynthesisSpeaking, voices, selectedVoice, setVoice } = useSpeechSynthesis()

  const [state, setState] = useState<VoiceChatState>({
    isActive: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    currentTranscript: '',
    interimTranscript: '',
    error: null,
  })

  const recognitionRef = useRef<any>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSpeechTimeRef = useRef<number>(0)
  const hasSpokenRef = useRef<boolean>(false)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setState((prev) => ({ ...prev, error: 'Speech recognition not supported in this browser' }))
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = continuousMode
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setState((prev) => ({ ...prev, isListening: true, error: null }))
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      setState((prev) => ({
        ...prev,
        currentTranscript: prev.currentTranscript + finalTranscript,
        interimTranscript,
      }))

      // Handle silence detection for auto-send
      if (finalTranscript.trim()) {
        lastSpeechTimeRef.current = Date.now()
        hasSpokenRef.current = true

        // Clear existing timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
        }

        // Set new timeout for silence detection
        if (continuousMode) {
          silenceTimeoutRef.current = setTimeout(() => {
            handleAutoSend()
          }, silenceDetectionTime)
        }
      }
    }

    recognition.onerror = (event: any) => {
      setState((prev) => ({
        ...prev,
        error: `Speech recognition error: ${event.error}`,
        isListening: false,
      }))
    }

    recognition.onend = () => {
      setState((prev) => {
        const newState = { ...prev, isListening: false }

        // Restart recognition if in continuous mode and still active
        if (newState.isActive && continuousMode && !newState.isSpeaking) {
          setTimeout(() => {
            if (recognitionRef.current && newState.isActive) {
              recognitionRef.current.start()
            }
          }, 100)
        }

        return newState
      })
    }

    recognitionRef.current = recognition

    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      recognition.stop()
    }
  }, [language, continuousMode, interimResults, silenceDetectionTime])

  const handleAutoSend = useCallback(() => {
    if (state.currentTranscript.trim() && hasSpokenRef.current) {
      const message = state.currentTranscript.trim()
      setState((prev) => ({
        ...prev,
        currentTranscript: '',
        interimTranscript: '',
        isProcessing: true,
      }))

      onMessageSend(message)
      hasSpokenRef.current = false
    }
  }, [state.currentTranscript, onMessageSend])

  const startVoiceChat = useCallback(() => {
    if (!recognitionRef.current) {
      setState((prev) => ({ ...prev, error: 'Speech recognition not available' }))
      return
    }

    setState((prev) => ({
      ...prev,
      isActive: true,
      error: null,
      currentTranscript: '',
      interimTranscript: '',
    }))

    try {
      recognitionRef.current.start()
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to start speech recognition',
        isActive: false,
      }))
    }
  }, [])

  const stopVoiceChat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      isListening: false,
      currentTranscript: '',
      interimTranscript: '',
    }))

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }

    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speakResponse = useCallback(
    (text: string) => {
      setState((prevState) => {
        if (!autoSpeak || !prevState.isActive) return prevState

        // Stop recognition while speaking
        if (recognitionRef.current && prevState.isListening) {
          recognitionRef.current.stop()
        }

        speak(text, () => {
          setState((prev) => {
            const newState = { ...prev, isSpeaking: false, isProcessing: false }

            // Restart recognition after speaking in continuous mode
            if (newState.isActive && continuousMode) {
              setTimeout(() => {
                if (recognitionRef.current && newState.isActive) {
                  recognitionRef.current.start()
                }
              }, 500) // Small delay before restarting
            }

            return newState
          })
        })

        return { ...prevState, isSpeaking: true }
      })
    },
    [autoSpeak, continuousMode, speak],
  )

  const sendCurrentTranscript = useCallback(() => {
    if (state.currentTranscript.trim()) {
      handleAutoSend()
    }
  }, [state.currentTranscript, handleAutoSend])

  const clearTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentTranscript: '',
      interimTranscript: '',
    }))
    hasSpokenRef.current = false
  }, [])

  // Update speaking state based on speech synthesis
  useEffect(() => {
    setState((prev) => ({ ...prev, isSpeaking: speechSynthesisSpeaking }))
  }, [speechSynthesisSpeaking])

  // Note: Response handling is done externally via the speakResponse function

  return {
    ...state,
    voices,
    selectedVoice,
    setVoice,
    startVoiceChat,
    stopVoiceChat,
    speakResponse,
    sendCurrentTranscript,
    clearTranscript,
    isSupported: !!recognitionRef.current,
  }
}
