# Voice Chat Feature

A continuous voice chat feature that allows users to have natural conversations with AI using speech-to-text and text-to-speech technologies.

## Features

- 🎤 **Speech Recognition**: Real-time speech-to-text conversion
- 🔊 **Text-to-Speech**: AI responses are spoken aloud
- 🔄 **Continuous Mode**: Automatic turn-taking for natural conversation flow
- 🎯 **Silence Detection**: Automatically sends messages after detecting silence
- 🔇 **Mute Control**: Toggle AI voice responses on/off
- 📝 **Live Transcript**: See what you're saying in real-time
- 🎨 **Beautiful UI**: Modern, intuitive interface with visual indicators
- 📱 **Responsive**: Works on both desktop and mobile devices

## How It Works

### Starting a Voice Chat

1. Click the floating phone button in the bottom-right corner of the chat interface
2. Click the green "Start Call" button in the voice chat modal
3. Grant microphone permissions when prompted

### During a Voice Chat

- **Green status**: Listening to your voice
- **Purple status**: AI is speaking
- **Blue status**: Processing your message
- The system automatically detects when you finish speaking (2-second silence) and sends your message
- AI responses are automatically spoken aloud (unless muted)

### Controls

- **Red Phone Button**: End the voice chat
- **Volume Button**: Mute/unmute AI voice responses
- **Message Button**: Manually send current transcript
- **Show/Hide Transcript**: Toggle transcript visibility
- **Clear**: Clear current transcript

## Technical Implementation

### Components

- **`useVoiceChat`**: Core hook managing speech recognition and synthesis
- **`VoiceChatInterface`**: Modal UI component for voice chat
- **`useSpeechSynthesis`**: Hook for text-to-speech functionality

### Browser Support

- **Chrome/Edge**: Full support with Web Speech API
- **Safari**: Supported on iOS and macOS
- **Firefox**: Limited speech recognition support

### Key Features

1. **Continuous Recognition**: Uses Web Speech API with continuous mode
2. **Silence Detection**: 2-second timeout for automatic message sending
3. **Voice Selection**: Automatically selects the best available voice
4. **Error Handling**: Graceful degradation when speech APIs aren't available
5. **State Management**: Proper cleanup and state synchronization

## Usage Examples

### Basic Voice Chat

```typescript
import { VoiceChatInterface } from './components/VoiceChatInterface'

function ChatPage() {
  const [isOpen, setIsOpen] = useState(false)

  const handleVoiceMessage = (message: string) => {
    // Send message to your chat system
    sendMessage(message)
  }

  return (
    <VoiceChatInterface
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onMessageSend={handleVoiceMessage}
      onResponse={() => {}}
      lastAIResponse={lastResponse}
    />
  )
}
```

### Custom Hook Usage

```typescript
import { useVoiceChat } from '@/hooks/useVoiceChat'

function MyComponent() {
  const { isActive, isListening, isSpeaking, currentTranscript, startVoiceChat, stopVoiceChat, speakResponse } =
    useVoiceChat(handleMessageSend, handleResponse, {
      autoSpeak: true,
      continuousMode: true,
      silenceDetectionTime: 2000,
    })

  // Use the voice chat state and controls
}
```

## Configuration Options

### Voice Chat Options

- **`autoSpeak`**: Automatically speak AI responses (default: true)
- **`continuousMode`**: Keep listening after each message (default: true)
- **`interimResults`**: Show partial transcription results (default: true)
- **`language`**: Speech recognition language (default: 'en-US')
- **`silenceDetectionTime`**: Milliseconds to wait before auto-sending (default: 2000)

### Speech Synthesis

- Automatically selects the best available voice
- Prefers Google voices for better quality
- Fallback to system default voices
- Sanitizes text to remove markdown and code blocks

## Troubleshooting

### Common Issues

1. **Microphone Permission**: Ensure microphone access is granted
2. **Browser Support**: Use Chrome, Edge, or Safari for best experience
3. **HTTPS Required**: Speech recognition requires secure context (HTTPS)
4. **Background Tabs**: May pause in inactive browser tabs

### Browser Compatibility

- ✅ Chrome/Chromium: Full support
- ✅ Edge: Full support
- ✅ Safari: iOS/macOS support
- ⚠️ Firefox: Limited support
- ❌ Older browsers: Not supported

## Privacy & Security

- All speech processing happens locally in the browser
- No audio data is sent to external servers
- Speech recognition uses browser's built-in APIs
- Voice synthesis uses system voices

## Future Enhancements

- [ ] Voice activity detection improvements
- [ ] Custom wake words
- [ ] Multiple language support
- [ ] Voice training and adaptation
- [ ] Integration with more TTS providers
- [ ] Offline speech recognition
- [ ] Conversation history in voice mode
- [ ] Voice shortcuts and commands
