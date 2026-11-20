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
        
        <div className="space-y-4 rounded-xl bg-muted/20 border border-border/50 p-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">Read Aloud Voice</Label>
            <p className="text-sm text-muted-foreground">Choose the voice used for reading messages aloud.</p>

            {englishVoices.length > 0 ? (
              <RadioGroup value={selectedVoice || ''} onValueChange={setVoice} className="gap-1.5">
                {englishVoices.map((voice) => (
                  <div
                    key={voice.voiceURI}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30 transition-colors hover:bg-muted/60 has-[[data-state=checked]]:border-rose-500/30 has-[[data-state=checked]]:bg-rose-500/10 dark:has-[[data-state=checked]]:border-rose-300/30 dark:has-[[data-state=checked]]:bg-rose-300/10"
                  >
                    <RadioGroupItem value={voice.voiceURI} id={voice.voiceURI} />
                    <Label htmlFor={voice.voiceURI} className="flex-1 cursor-pointer font-normal">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {voice.name}
                          {voice.name.toLowerCase().includes('google') && (
                            <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:bg-rose-300/10 dark:text-rose-300">
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
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <p className="text-sm text-muted-foreground">No English voices available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Voice Preview</h3>
        
        <div className="space-y-3 rounded-xl bg-muted/20 border border-border/50 p-4">
          <Button
            onClick={handleVoicePreview}
            disabled={!selectedVoice || englishVoices.length === 0}
            variant="outline"
            className="w-full"
          >
            {isSpeaking ? (
              <>
                <Square className="fill-current" />
                Stop Preview
              </>
            ) : (
              <>
                <Play />
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
