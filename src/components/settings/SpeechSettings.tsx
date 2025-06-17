'use client';

import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function SpeechSettings() {
  const { voices, selectedVoice, setVoice } = useSpeechSynthesis();

  const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Speech Settings</h3>
      <div className="space-y-2">
        <Label htmlFor="voice-select">Read Aloud Voice</Label>
        <Select
          value={selectedVoice || ''}
          onValueChange={setVoice}
          disabled={englishVoices.length === 0}
        >
          <SelectTrigger id="voice-select" className="w-full">
            <SelectValue placeholder="Select a voice..." />
          </SelectTrigger>
          <SelectContent>
            {englishVoices.length > 0 ? (
              englishVoices.map(voice => (
                <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-voices" disabled>
                No English voices available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Choose the voice used for reading messages aloud.
        </p>
      </div>
    </div>
  );
} 