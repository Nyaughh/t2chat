'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Cloud, Cpu, Download, Loader2, MonitorSpeaker, Play, RotateCcw, Square } from 'lucide-react'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { startLocalDownload } from '@/lib/tts/download-toast'
import { getSpeechState, stopSpeaking, type DownloadChoice } from '@/lib/tts/controller'
import { isLocalModelSavedInBrowser, removeLocalModel } from '@/lib/tts/local-model'
import { DownloadProgress, MODEL_SIZE, useLocalModel } from '@/lib/tts/local-model-ui'
import { ENGINES, GEMINI_VOICES, LOCAL_VOICES, type TtsEngine, type VoiceOption } from '@/lib/tts/voices'
import { SettingsCard, SettingsGroup } from './primitives'

const PREVIEW_PREFIX = 'preview:'
const PREVIEW_TEXT = "Hi! This is how I'll sound when I read replies aloud. I hope you like this voice."

const ENGINE_ICONS: Record<TtsEngine, typeof Cpu> = { local: Cpu, gemini: Cloud, browser: MonitorSpeaker }

const rowClass =
  'flex items-center gap-3 px-3 py-2 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-foreground/[0.03] has-[[data-state=checked]]:bg-rose-500/[0.06] dark:has-[[data-state=checked]]:bg-rose-300/[0.06]'

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-rose-500/10 px-1.5 py-px text-[11px] text-rose-600 dark:bg-rose-300/10 dark:text-rose-300">
      {children}
    </span>
  )
}

const linkButton =
  'cursor-pointer rounded text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Download state of the on-device model, shown under its engine option. */
function LocalModelStatus() {
  const model = useLocalModel()
  const download = () => void startLocalDownload().catch(() => {})

  switch (model.state) {
    case 'unknown':
      return null
    case 'downloading':
      return <DownloadProgress model={model} className="mt-2 max-w-sm" />
    case 'error':
      return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs text-destructive">{model.message}</span>
          <Button type="button" size="sm" variant="outline" onClick={download}>
            <RotateCcw />
            Retry
          </Button>
        </div>
      )
    case 'absent':
      return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button type="button" size="sm" variant="outline" onClick={download}>
            <Download />
            Download ({MODEL_SIZE})
          </Button>
          <span className="text-xs text-muted-foreground">
            One time. Or it&apos;s offered the first time you press read aloud.
          </span>
        </div>
      )
    default:
      // cached, loading or ready
      return (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          {isLocalModelSavedInBrowser()
            ? `Downloaded (${MODEL_SIZE}). Runs on this device.`
            : "Loaded for this tab only: your browser didn't let us save it."}
          <button type="button" className={cn(linkButton, 'ml-1')} onClick={() => void removeLocalModel()}>
            Remove
          </button>
        </p>
      )
  }
}

/**
 * The download choice for a first preview, shown inside the dialog: a modal
 * blocks pointer events and focus outside it, so the toast prompt used in the
 * chat can't be reached from here.
 */
function PreviewDownloadPrompt({
  voiceName,
  onChoose,
}: {
  voiceName: string
  onChoose: (choice: DownloadChoice) => void
}) {
  const downloadRef = useRef<HTMLButtonElement>(null)
  useEffect(() => downloadRef.current?.focus(), [])
  return (
    <div role="group" aria-label="Download the on-device voice">
      <SettingsCard>
        {/* One child: SettingsCard draws hairlines between its direct children. */}
        <div className="px-3 py-3">
          <p className="text-sm">
            To hear {voiceName}, download the on-device voice ({MODEL_SIZE}).
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One time. After that it runs in your browser, free and offline.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button ref={downloadRef} type="button" size="sm" onClick={() => onChoose('download')}>
              <Download />
              Download and play
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChoose('browser')}>
              Use system voice
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChoose('dismiss')}>
              Cancel
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

function VoiceRow({
  voice,
  engine,
  isPlaying,
  isLoading,
  onPreview,
}: {
  voice: VoiceOption
  engine: TtsEngine
  isPlaying: boolean
  isLoading: boolean
  onPreview: () => void
}) {
  const id = `voice-${engine}-${voice.id}`
  const meta = [voice.accent && `${voice.accent} English`, voice.gender, voice.description].filter(Boolean).join(' · ')
  return (
    <div className={rowClass}>
      <RadioGroupItem value={voice.id} id={id} />
      <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 font-normal">
        <span className="truncate text-sm">{voice.name}</span>
        {voice.recommended && <Badge>Recommended</Badge>}
      </Label>
      {meta && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{meta}</span>}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        onClick={onPreview}
        aria-label={isPlaying || isLoading ? `Stop preview of ${voice.name}` : `Preview ${voice.name}`}
      >
        {isLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Square className="fill-current" /> : <Play />}
      </Button>
    </div>
  )
}

export default function SpeechSettings() {
  const {
    voices,
    selectedVoice,
    setVoice,
    speak,
    stop,
    status,
    speakingId,
    engine,
    setEngine,
    engineVoice,
    setEngineVoice,
  } = useSpeechSynthesis()
  const { isSignedIn } = useAuth()

  // System voices: English only, Google voices first
  const systemVoices: VoiceOption[] = useMemo(
    () =>
      voices
        .filter((voice) => voice.lang.startsWith('en'))
        .sort((a, b) => {
          const aGoogle = a.name.toLowerCase().includes('google')
          const bGoogle = b.name.toLowerCase().includes('google')
          if (aGoogle !== bGoogle) return aGoogle ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .map((voice) => ({
          id: voice.voiceURI,
          name: voice.name,
          description: voice.lang,
          recommended: voice.name.toLowerCase().includes('google'),
        })),
    [voices],
  )

  const voiceList = engine === 'local' ? LOCAL_VOICES : engine === 'gemini' ? GEMINI_VOICES : systemVoices
  const currentVoice = engine === 'browser' ? selectedVoice : engineVoice

  // Leaving the pane stops its own preview, never a reading started elsewhere.
  useEffect(
    () => () => {
      if (getSpeechState().ownerId?.startsWith(PREVIEW_PREFIX)) stopSpeaking()
    },
    [],
  )

  // A first preview without the model asks here, inside the dialog.
  const [downloadAsk, setDownloadAsk] = useState<{
    voiceName: string
    choose: (choice: DownloadChoice) => void
  } | null>(null)
  const askInDialog = (voiceName: string) => (signal: AbortSignal) =>
    new Promise<DownloadChoice>((resolve) => {
      let settled = false
      const choose = (choice: DownloadChoice) => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', onAbort)
        setDownloadAsk((current) => (current?.choose === choose ? null : current))
        resolve(choice)
      }
      // Another preview, a stop or closing the pane withdraws the question.
      const onAbort = () => choose('dismiss')
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
      setDownloadAsk({ voiceName, choose })
    })

  const previewId = (voiceId: string) => `${PREVIEW_PREFIX}${engine}:${voiceId}`
  const handlePreview = (voice: VoiceOption) => {
    if (speakingId === previewId(voice.id)) return stop()
    speak(PREVIEW_TEXT, undefined, {
      ownerId: previewId(voice.id),
      engine,
      voice: voice.id,
      plain: true,
      askDownload: askInDialog(voice.name),
    })
  }

  const handleVoiceChange = (voiceId: string) => {
    if (engine === 'browser') setVoice(voiceId)
    else setEngineVoice(engine, voiceId)
  }

  return (
    <div className="space-y-6">
      <SettingsGroup title="Read-aloud engine" description="How messages are turned into speech.">
        <RadioGroup
          value={engine}
          onValueChange={(value) => setEngine(value as TtsEngine)}
          aria-label="Read-aloud engine"
          className="gap-0"
        >
          <SettingsCard>
            {ENGINES.map((option) => {
              const Icon = ENGINE_ICONS[option.id]
              const locked = option.id === 'gemini' && !isSignedIn
              return (
                <div key={option.id} className={cn(rowClass, 'items-start py-2.5', locked && 'opacity-60')}>
                  <RadioGroupItem value={option.id} id={`engine-${option.id}`} disabled={locked} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={`engine-${option.id}`}
                      className={cn('flex flex-col items-start gap-0.5 font-normal', !locked && 'cursor-pointer')}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Icon className="size-4 text-muted-foreground" />
                        {option.name}
                        {option.id === 'local' && <Badge>Recommended</Badge>}
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {locked ? 'Sign in to use Gemini voices.' : option.description}
                      </span>
                    </Label>
                    {option.id === 'local' && <LocalModelStatus />}
                  </div>
                </div>
              )
            })}
          </SettingsCard>
        </RadioGroup>
      </SettingsGroup>

      <SettingsGroup
        title="Voice"
        description={
          engine === 'local'
            ? 'Press play to hear a voice. The first preview offers the one-time download.'
            : 'Press play to hear a voice.'
        }
      >
        {voiceList.length > 0 ? (
          <RadioGroup
            value={currentVoice ?? ''}
            onValueChange={handleVoiceChange}
            aria-label="Read aloud voice"
            className="gap-0"
          >
            <SettingsCard>
              {voiceList.map((voice) => {
                const active = speakingId === previewId(voice.id)
                return (
                  <VoiceRow
                    key={voice.id}
                    voice={voice}
                    engine={engine}
                    isPlaying={active && status === 'speaking'}
                    isLoading={active && status === 'loading'}
                    onPreview={() => handlePreview(voice)}
                  />
                )
              })}
            </SettingsCard>
          </RadioGroup>
        ) : (
          <SettingsCard>
            <p className="px-3 py-3 text-sm text-muted-foreground">No English voices are available in this browser.</p>
          </SettingsCard>
        )}
        {downloadAsk && <PreviewDownloadPrompt voiceName={downloadAsk.voiceName} onChoose={downloadAsk.choose} />}
      </SettingsGroup>
    </div>
  )
}
