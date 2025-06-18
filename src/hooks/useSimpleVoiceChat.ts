import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

export function useSimpleVoiceChat(onSendMessage?: (message: string, conversationHistory: Array<{role: 'user' | 'assistant', content: string}>) => Promise<string>) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  
  const { speak, isSpeaking: synthesisSpeaking } = useSpeechSynthesis();
  const recognitionRef = useRef<any>(null);
  const isWaitingForResponse = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTranscript(prev => prev + transcript + ' ');
      
      // Add user message to conversation history first
      const newUserMessage = { role: 'user' as const, content: transcript };
      setConversationHistory(prev => {
        const updatedHistory = [...prev, newUserMessage];
        
        // Stop listening and get AI response
        setIsListening(false);
        isWaitingForResponse.current = true;
        
        // Get AI response with conversation context
        if (onSendMessage) {
          onSendMessage(transcript, prev).then((aiResponse) => {
            setConversationHistory(current => [...current, { role: 'assistant', content: aiResponse }]);
            
            // Speak the response
            speak(aiResponse, () => {
              isWaitingForResponse.current = false;
              // Start listening again after AI finishes speaking
              if (isActive) {
                setTimeout(() => {
                  if (recognitionRef.current && isActive) {
                    recognitionRef.current.start();
                  }
                }, 500);
              }
            });
          }).catch(() => {
            isWaitingForResponse.current = false;
            // Restart listening on error
            if (isActive) {
              setTimeout(() => {
                if (recognitionRef.current && isActive) {
                  recognitionRef.current.start();
                }
              }, 1000);
            }
          });
        } else {
          // Fallback to mock response
          setTimeout(() => {
            const aiResponse = `I heard you say: "${transcript}". This is a mock response.`;
            setConversationHistory(current => [...current, { role: 'assistant', content: aiResponse }]);
            
            // Speak the response
            speak(aiResponse, () => {
              isWaitingForResponse.current = false;
              // Start listening again after AI finishes speaking
              if (isActive) {
                setTimeout(() => {
                  if (recognitionRef.current && isActive) {
                    recognitionRef.current.start();
                  }
                }, 500);
              }
            });
          }, 1000);
        }
        
        return updatedHistory;
      });
    };

    recognition.onerror = () => {
      setIsListening(false);
      // Restart if still active
      if (isActive && !isWaitingForResponse.current) {
        setTimeout(() => {
          if (recognitionRef.current && isActive) {
            recognitionRef.current.start();
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [isActive, speak, onSendMessage]);

  // Update speaking state
  useEffect(() => {
    setIsSpeaking(synthesisSpeaking);
  }, [synthesisSpeaking]);

  const startVoiceChat = useCallback(() => {
    setIsActive(true);
    setTranscript('');
    setConversationHistory([]);
    
    // Start listening
    setTimeout(() => {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    }, 100);
  }, []);

  const endVoiceChat = useCallback(() => {
    setIsActive(false);
    setIsListening(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    return transcript; // Return transcript for saving to chat
  }, [transcript]);

  return {
    isActive,
    isListening,
    isSpeaking,
    transcript,
    conversationHistory,
    startVoiceChat,
    endVoiceChat,
    isSupported: !!recognitionRef.current,
  };
} 