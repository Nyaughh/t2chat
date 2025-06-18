import { useCallback } from 'react'
import { parseDataStream } from '@/lib/stream-parser'

interface UserSettings {
  userName?: string
  userRole?: string
  userTraits?: string[]
  userAdditionalInfo?: string
  promptTemplate?: string
}

export function useVoiceChatAPI() {
  const sendVoiceMessage = useCallback(
    async (
      message: string,
      modelId: string,
      conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
      userSettings?: UserSettings | null,
    ): Promise<string> => {
      try {
        // Build the full conversation context - user context is handled in system prompt
        const messages = [
          ...conversationHistory.map((msg) => ({ role: msg.role, content: msg.content })),
          { role: 'user' as const, content: message },
        ]

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            data: {
              modelId,
              // Pass user settings for system prompt personalization
              userSettings: userSettings
                ? {
                    userName: userSettings.userName,
                    userRole: userSettings.userRole,
                    userTraits: userSettings.userTraits,
                    userAdditionalInfo: userSettings.userAdditionalInfo,
                    promptTemplate: userSettings.promptTemplate,
                  }
                : undefined,
            },
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
    },
    [],
  )

  return { sendVoiceMessage }
}
