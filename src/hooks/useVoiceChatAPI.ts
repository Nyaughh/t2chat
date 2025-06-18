import { useCallback } from 'react'
import { parseDataStream } from '@/lib/stream-parser'

export function useVoiceChatAPI() {
  const sendVoiceMessage = useCallback(async (
    message: string, 
    modelId: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
  ): Promise<string> => {
    try {
      // Build the full conversation context
      const messages = [
        ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user' as const, content: message }
      ]

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          data: { modelId },
        }),
      })

      if (!response.body) throw new Error('No response body')

      const dataStream = parseDataStream(response.body)
      let fullResponse = ''

      for await (const chunk of dataStream) {
        if (chunk.type === 'text') {
          fullResponse += chunk.value
        }
      }

      return fullResponse.trim() || 'Sorry, I could not generate a response.'
    } catch (error) {
      console.error('Voice chat API error:', error)
      return 'Sorry, there was an error processing your message.'
    }
  }, [])

  return { sendVoiceMessage }
} 