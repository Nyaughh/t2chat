'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { X, Plus, CornerDownLeft, ArrowBigUp, MousePointerClick, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { AppearanceSection } from './customization/AppearanceSection'
import { Row, Section, Segmented, fieldClass } from './customization/controls'

// Define Customization type
export type CustomizationState = {
  userName: string
  userRole: string
  userTraits: string[]
  userAdditionalInfo: string
  promptTemplate: string
  /** Legacy: fonts now live in the appearance engine (src/lib/theme); kept for callers that still pass them. */
  mainFont: 'inter' | 'system' | 'serif' | 'mono' | 'roboto-slab'
  /** Legacy: see `mainFont`. */
  codeFont: 'fira-code' | 'mono' | 'consolas' | 'jetbrains' | 'source-code-pro'
  sendBehavior: 'enter' | 'shiftEnter' | 'button'
  showTimestamps: boolean
}

/** The fields saved with the "Save changes" bar (appearance saves itself). */
type ProfileFields = Omit<CustomizationState, 'mainFont' | 'codeFont'>

const profileFields = (c: CustomizationState): ProfileFields => ({
  userName: c.userName,
  userRole: c.userRole,
  userTraits: c.userTraits,
  userAdditionalInfo: c.userAdditionalInfo,
  promptTemplate: c.promptTemplate,
  sendBehavior: c.sendBehavior,
  showTimestamps: c.showTimestamps,
})

const TextField = ({
  id,
  label,
  description,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
}: {
  id: string
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  multiline?: boolean
  rows?: number
}) => (
  <div className="space-y-1.5 px-4 py-3.5">
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {label}
    </label>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
    {multiline ? (
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldClass, 'resize-y')}
      />
    ) : (
      <input
        type="text"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    )}
  </div>
)

export function CustomizeSettings({ customization }: { customization: CustomizationState }) {
  const [local, setLocal] = useState<ProfileFields>(() => profileFields(customization))
  const [traitInput, setTraitInput] = useState('')
  const updateSettings = useMutation(api.users.updateUserSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Server data changed (first load, or saved elsewhere): take it, unless the user is mid-edit.
  useEffect(() => {
    if (isDirty) return
    setLocal(profileFields(customization))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customization])

  const handleChange = <K extends keyof ProfileFields>(field: K, value: ProfileFields[K]) => {
    setLocal((prev) => ({ ...prev, [field]: value }))
    setIsDirty(true)
    setSaveError(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateSettings(local)
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to save settings', error)
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    setLocal(profileFields(customization))
    setIsDirty(false)
    setSaveError(null)
  }

  const handleAddTrait = () => {
    const trait = traitInput.trim()
    if (trait && !local.userTraits.includes(trait)) {
      handleChange('userTraits', [...local.userTraits, trait])
    }
    setTraitInput('')
  }

  return (
    <div className="space-y-8">
      <AppearanceSection />

      <Section title="Personalization" description="What the AI should know about you.">
        <TextField
          id="userName"
          label="Your name"
          value={local.userName}
          onChange={(v) => handleChange('userName', v)}
          placeholder="e.g., Jane Doe"
        />
        <TextField
          id="userRole"
          label="Your role or profession"
          value={local.userRole}
          onChange={(v) => handleChange('userRole', v)}
          placeholder="e.g., Software Engineer, Student"
        />
        <div className="space-y-2 px-4 py-3.5">
          <label htmlFor="userTraitInput" className="block text-sm font-medium text-foreground">
            Interests and traits
          </label>
          {local.userTraits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {local.userTraits.map((trait, index) => (
                <span
                  key={`${trait}-${index}`}
                  className="flex max-w-full items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 py-0.5 pr-0.5 pl-2.5 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200"
                >
                  <span className="truncate">{trait}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleChange(
                        'userTraits',
                        local.userTraits.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`Remove ${trait}`}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-70 transition hover:bg-rose-500/15 hover:opacity-100 dark:hover:bg-rose-300/15"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              id="userTraitInput"
              type="text"
              value={traitInput}
              onChange={(e) => setTraitInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTrait()
                }
              }}
              placeholder="Add a trait and press Enter"
              className={cn(fieldClass, 'pr-11')}
            />
            <Button
              onClick={handleAddTrait}
              variant="ghost"
              size="icon-xs"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              disabled={!traitInput.trim()}
              aria-label="Add trait"
            >
              <Plus />
            </Button>
          </div>
        </div>
        <TextField
          id="userAdditionalInfo"
          label="Additional information"
          value={local.userAdditionalInfo}
          onChange={(v) => handleChange('userAdditionalInfo', v)}
          placeholder="Anything else you want the AI to know about you?"
          multiline
        />
      </Section>

      <Section title="Prompt template">
        <TextField
          id="promptTemplate"
          label="System prompt"
          description="Added to the start of every conversation."
          value={local.promptTemplate}
          onChange={(v) => handleChange('promptTemplate', v)}
          placeholder="e.g., You are a helpful assistant that is an expert in..."
          multiline
          rows={5}
        />
      </Section>

      <Section title="Behavior">
        <Row label="Send message with" description="Which key sends; the other inserts a new line.">
          <Segmented
            label="Send message with"
            value={local.sendBehavior}
            options={[
              { value: 'enter', label: <SendLabel icon={CornerDownLeft} text="Enter" /> },
              { value: 'shiftEnter', label: <SendLabel icon={ArrowBigUp} text="Shift + Enter" /> },
              { value: 'button', label: <SendLabel icon={MousePointerClick} text="Button only" /> },
            ]}
            onChange={(v) => handleChange('sendBehavior', v)}
          />
        </Row>
        <Row label="Show message timestamps" description="Display the time for each message." htmlFor="showTimestamps">
          <Switch
            id="showTimestamps"
            checked={local.showTimestamps}
            onCheckedChange={(checked) => handleChange('showTimestamps', checked)}
          />
        </Row>
      </Section>

      {isDirty && (
        // Sticks to the bottom of whatever scroll container renders this section.
        <div className="sticky bottom-0 z-20 -mx-1 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-popover/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
            <p className={cn('text-sm', saveError ? 'text-destructive' : 'text-muted-foreground')} role="status">
              {saveError ?? 'You have unsaved changes.'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={isSaving}>
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving && <Loader2 className="animate-spin" />}
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SendLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  )
}
