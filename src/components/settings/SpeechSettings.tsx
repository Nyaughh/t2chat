'use client'

import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Play, Square } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export default function SpeechSettings() {
  const { voices, selectedVoice, setVoice, speak, stop, isSpeaking } = useSpeechSynthesis()

  // Filter and sort voices - Google voices first, then others
  const englishVoices = voices
    .filter((voice: any) => voice.lang.startsWith('en'))
    .sort((a: any, b: any) => {
      const aIsGoogle = a.name.toLowerCase().includes('google')
      const bIsGoogle = b.name.toLowerCase().includes('google')

      if (aIsGoogle && !bIsGoogle) return -1
      if (!aIsGoogle && bIsGoogle) return 1
      return a.name.localeCompare(b.name)
    })

  const handleVoicePreview = () => {
    if (isSpeaking) {
      stop()
    } else {
      const previewText =
        'Hello! This is a preview of the selected voice. I hope you find this voice pleasant to listen to.'
      speak(previewText, () => {
        // Preview complete
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Voice Selection</h3>
        
        <div className="space-y-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50 p-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">Read Aloud Voice</Label>
            <p className="text-sm text-muted-foreground">Choose the voice used for reading messages aloud.</p>

            {englishVoices.length > 0 ? (
              <RadioGroup value={selectedVoice || ''} onValueChange={setVoice} className="space-y-1">
                {englishVoices.map((voice) => (
                  <div
                    key={voice.voiceURI}
                    className="flex items-center space-x-3 p-2.5 rounded-lg border border-border/50 hover:border-border/80 transition-colors"
                  >
                    <RadioGroupItem value={voice.voiceURI} id={voice.voiceURI} />
                    <Label htmlFor={voice.voiceURI} className="flex-1 cursor-pointer font-normal">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {voice.name}
                          {voice.name.toLowerCase().includes('google') && (
                            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{voice.lang}</span>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                <p className="text-sm text-muted-foreground">No English voices available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Voice Preview</h3>
        
        <div className="space-y-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50 p-4">
          <Button
            onClick={handleVoicePreview}
            disabled={!selectedVoice || englishVoices.length === 0}
            variant="outline"
            className="w-full"
          >
            {isSpeaking ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop Preview
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Test Voice
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">Click to hear a sample of the selected voice.</p>
        </div>
      </div>
    </div>
  )
}
