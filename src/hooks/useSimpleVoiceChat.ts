import { useState, useEffect, useRef, useCallback } from 'react'
import { useSpeechSynthesis } from './useSpeechSynthesis'

export function useSimpleVoiceChat(
  onSendMessage?: (
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => Promise<string>,
) {
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([])

  const { speak, stop: stopSpeech, isSpeaking: synthesisSpeaking } = useSpeechSynthesis()
  const recognitionRef = useRef<any>(null)
  const isWaitingForResponse = useRef(false)
  const currentHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  // Keep ref in sync with state
  useEffect(() => {
    currentHistoryRef.current = conversationHistory
  }, [conversationHistory])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      if (isActive) {
        setIsListening(true)
      }
    }

    recognition.onresult = async (event: any) => {
      // Only process if still active
      if (!isActive) return

      const transcript = event.results[0][0].transcript
      setTranscript((prev) => prev + transcript + ' ')

      // Stop listening and get AI response
      setIsListening(false)
      isWaitingForResponse.current = true

      try {
        // Double check if still active before processing
        if (!isActive) {
          isWaitingForResponse.current = false
          return
        }

        // Get current conversation history
        const currentHistory = currentHistoryRef.current
        const newUserMessage = { role: 'user' as const, content: transcript }

        // Add user message first
        const historyWithUser = [...currentHistory, newUserMessage]
        setConversationHistory(historyWithUser)

        if (onSendMessage && isActive) {
          // Get AI response using the original history (without the new user message for context)
          const aiResponse = await onSendMessage(transcript, currentHistory)

          // Check again if still active before adding response
          if (!isActive) {
            isWaitingForResponse.current = false
            return
          }

          const aiMessage = { role: 'assistant' as const, content: aiResponse }

          // Add AI response
          setConversationHistory([...historyWithUser, aiMessage])

          // Only speak if still active
          if (isActive) {
            speak(aiResponse, () => {
              isWaitingForResponse.current = false
              // Start listening again after AI finishes speaking, but only if still active
              if (isActive) {
                setTimeout(() => {
                  if (recognitionRef.current && isActive) {
                    try {
                      recognitionRef.current.start()
                    } catch (error) {
                      // Ignore errors if recognition is already started or stopped
                    }
                  }
                }, 500)
              }
            })
          } else {
            isWaitingForResponse.current = false
          }
        } else if (isActive) {
          // Fallback to mock response
          setTimeout(() => {
            if (!isActive) return

            const aiResponse = `I heard you say: "${transcript}". This is a mock response.`
            const aiMessage = { role: 'assistant' as const, content: aiResponse }

            setConversationHistory([...historyWithUser, aiMessage])

            // Only speak if still active
            if (isActive) {
              speak(aiResponse, () => {
                isWaitingForResponse.current = false
                // Start listening again after AI finishes speaking, but only if still active
                if (isActive) {
                  setTimeout(() => {
                    if (recognitionRef.current && isActive) {
                      try {
                        recognitionRef.current.start()
                      } catch (error) {
                        // Ignore errors if recognition is already started or stopped
                      }
                    }
                  }, 500)
                }
              })
            } else {
              isWaitingForResponse.current = false
            }
          }, 1000)
        }
      } catch (error) {
        console.error('Error getting AI response:', error)
        isWaitingForResponse.current = false
        // Restart listening on error, but only if still active
        if (isActive) {
          setTimeout(() => {
            if (recognitionRef.current && isActive) {
              try {
                recognitionRef.current.start()
              } catch (error) {
                // Ignore errors if recognition is already started or stopped
              }
            }
          }, 1000)
        }
      }
    }

    recognition.onerror = () => {
      if (isActive) {
        setIsListening(false)
        // Restart if still active
        if (isActive && !isWaitingForResponse.current) {
          setTimeout(() => {
            if (recognitionRef.current && isActive) {
              try {
                recognitionRef.current.start()
              } catch (error) {
                // Ignore errors if recognition is already started or stopped
              }
            }
          }, 1000)
        }
      }
    }

    recognition.onend = () => {
      if (isActive) {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
  }, [isActive, speak, onSendMessage])

  // Update speaking state
  useEffect(() => {
    setIsSpeaking(synthesisSpeaking)
  }, [synthesisSpeaking])

  // Stop everything when isActive becomes false
  useEffect(() => {
    if (!isActive) {
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore errors if already stopped
        }
      }

      // Stop speech synthesis
      stopSpeech()

      // Reset states
      setIsListening(false)
      isWaitingForResponse.current = false
    }
  }, [isActive, stopSpeech])

  const startVoiceChat = useCallback(() => {
    setIsActive(true)
    setTranscript('')
    setConversationHistory([])
    currentHistoryRef.current = []

    // Start listening
    setTimeout(() => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (error) {
          // Ignore errors if recognition is already started
        }
      }
    }, 100)
  }, [])

  const endVoiceChat = useCallback(() => {
    setIsActive(false)
    setIsListening(false)
    isWaitingForResponse.current = false

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        // Ignore errors if already stopped
      }
    }

    // Stop speech synthesis
    stopSpeech()

    return transcript // Return transcript for saving to chat
  }, [transcript, stopSpeech])

  return {
    isActive,
    isListening,
    isSpeaking,
    transcript,
    conversationHistory,
    startVoiceChat,
    endVoiceChat,
    isSupported: !!recognitionRef.current,
  }
}
