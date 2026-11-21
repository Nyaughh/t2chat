'use client'

import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Play, Square } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SettingsCard, SettingsGroup } from './primitives'

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
      <SettingsGroup
        title="Read aloud voice"
        description="The voice used when you play a message aloud. Voices come from your browser and system."
        action={
          <Button
            onClick={handleVoicePreview}
            disabled={!selectedVoice || englishVoices.length === 0}
            variant="outline"
            size="sm"
          >
            {isSpeaking ? <Square className="fill-current" /> : <Play />}
            {isSpeaking ? 'Stop' : 'Preview'}
          </Button>
        }
      >
        {englishVoices.length > 0 ? (
          <RadioGroup
            value={selectedVoice || ''}
            onValueChange={setVoice}
            aria-label="Read aloud voice"
            className="gap-0"
          >
            <SettingsCard>
              {englishVoices.map((voice) => (
                <Label
                  key={voice.voiceURI}
                  htmlFor={voice.voiceURI}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 font-normal transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-foreground/[0.03] has-[[data-state=checked]]:bg-rose-500/[0.06] dark:has-[[data-state=checked]]:bg-rose-300/[0.06]"
                >
                  <RadioGroupItem value={voice.voiceURI} id={voice.voiceURI} />
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm">{voice.name}</span>
                    {voice.name.toLowerCase().includes('google') && (
                      <span className="shrink-0 rounded bg-rose-500/10 px-1.5 py-px text-[11px] text-rose-600 dark:bg-rose-300/10 dark:text-rose-300">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{voice.lang}</span>
                </Label>
              ))}
            </SettingsCard>
          </RadioGroup>
        ) : (
          <SettingsCard>
            <p className="px-3 py-3 text-sm text-muted-foreground">No English voices are available in this browser.</p>
          </SettingsCard>
        )}
      </SettingsGroup>
    </div>
  )
}
