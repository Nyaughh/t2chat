'use client'

import React, { useId, useRef, useState } from 'react'
import { Check, FileUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { findTheme, type Appearance } from '@/lib/theme/appearance'
import {
  MAX_CUSTOM_THEMES,
  MAX_THEME_INPUT,
  ThemeImportError,
  cleanThemeName,
  importTheme,
} from '@/lib/theme/import'
import { DEFAULT_PREVIEW, DEFAULT_THEME_ID, presetThemes } from '@/lib/theme/presets'
import type { ThemeDefinition } from '@/lib/theme/tokens'
import { fieldClass } from './controls'

type Mode = 'light' | 'dark'

function preview(theme: ThemeDefinition, mode: Mode) {
  if (theme.id === DEFAULT_THEME_ID) return DEFAULT_PREVIEW[mode]
  const palette = theme[mode] ?? theme[mode === 'dark' ? 'light' : 'dark']!
  const c = palette.colors
  return {
    background: c.background!,
    foreground: c.foreground!,
    accent: palette.accent ?? c.primary ?? c.foreground!,
    muted: c['muted-foreground'] ?? c.foreground!,
  }
}

function modesOf(theme: ThemeDefinition): Mode[] | null {
  if (theme.id === DEFAULT_THEME_ID || (theme.light && theme.dark)) return null
  return theme.light ? ['light'] : ['dark']
}

export function ThemePicker({
  appearance,
  update,
  mode,
  setMode,
}: {
  appearance: Appearance
  update: (patch: Partial<Appearance>) => void
  mode: Mode
  setMode: (mode: Mode) => void
}) {
  const [importing, setImporting] = useState(false)
  const themes = [...presetThemes(), ...appearance.customThemes]

  const select = (theme: ThemeDefinition) => {
    update({ themeId: theme.id })
    // A one-sided theme only looks like itself in its own mode.
    const only = modesOf(theme)
    if (only && !only.includes(mode)) setMode(only[0])
  }

  const remove = (id: string) => {
    update({
      customThemes: appearance.customThemes.filter((t) => t.id !== id),
      ...(appearance.themeId === id ? { themeId: DEFAULT_THEME_ID } : {}),
    })
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {themes.map((theme) => {
          const p = preview(theme, mode)
          const selected = appearance.themeId === theme.id
          const custom = theme.id.startsWith('custom:')
          const only = modesOf(theme)
          return (
            <div key={theme.id} className="relative min-w-0">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => select(theme)}
                style={{ background: p.background, color: p.foreground }}
                className={cn(
                  'flex h-12 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left transition-[box-shadow,border-color] duration-150',
                  custom && 'pr-9',
                  selected
                    ? 'border-transparent ring-2 ring-rose-500 ring-offset-1 ring-offset-background dark:ring-rose-300'
                    : 'border-border hover:ring-1 hover:ring-foreground/20',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{theme.name}</span>
                {only && (
                  <span className="shrink-0 text-[0.6875rem] opacity-70" style={{ color: p.muted }}>
                    {only[0] === 'dark' ? 'Dark only' : 'Light only'}
                  </span>
                )}
                <span aria-hidden className="flex shrink-0 items-center gap-1">
                  <span className="size-2.5 rounded-full" style={{ background: p.muted }} />
                  <span className="size-2.5 rounded-full" style={{ background: p.accent }} />
                </span>
                {selected && <Check aria-hidden className="size-4 shrink-0" style={{ color: p.accent }} />}
              </button>
              {custom && (
                <button
                  type="button"
                  onClick={() => remove(theme.id)}
                  aria-label={`Remove ${theme.name}`}
                  title="Remove this theme"
                  style={{ color: p.muted }}
                  className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md opacity-80 transition-opacity hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {importing ? (
        <ThemeImporter
          appearance={appearance}
          onCancel={() => setImporting(false)}
          onImported={(theme) => {
            update({
              // Importing under an existing name replaces that theme (as in Feather).
              customThemes: [...appearance.customThemes.filter((t) => t.name !== theme.name), theme],
              themeId: theme.id,
            })
            const only = modesOf(theme)
            if (only && !only.includes(mode)) setMode(only[0])
            setImporting(false)
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <Plus />
            Import theme
          </Button>
          {appearance.themeId !== DEFAULT_THEME_ID && (
            <Button variant="ghost" size="sm" onClick={() => update({ themeId: DEFAULT_THEME_ID })}>
              Use T2Chat default
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Current: {findTheme(appearance).name}
          </span>
        </div>
      )}
    </div>
  )
}

function ThemeImporter({
  appearance,
  onCancel,
  onImported,
}: {
  appearance: Appearance
  onCancel: () => void
  onImported: (theme: ThemeDefinition) => void
}) {
  const nameId = useId()
  const cssId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [css, setCss] = useState('')
  const [error, setError] = useState<string | null>(null)

  const atLimit = appearance.customThemes.length >= MAX_CUSTOM_THEMES

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_THEME_INPUT) {
      setError(`That file is too large (${Math.round(file.size / 1024)} KB). The limit is 64 KB.`)
      return
    }
    setCss(await file.text())
    if (!name.trim()) setName(file.name.replace(/\.(css|json|txt)$/i, '').replace(/[-_]+/g, ' '))
    setError(null)
  }

  const submit = () => {
    try {
      const parsed = importTheme(css)
      const replacing = appearance.customThemes.some((t) => t.name === cleanThemeName(name, ''))
      if (atLimit && !replacing) {
        setError(`You can keep up to ${MAX_CUSTOM_THEMES} imported themes. Remove one first.`)
        return
      }
      const finalName = cleanThemeName(name, `Imported ${appearance.customThemes.length + 1}`)
      const slug = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'theme'
      onImported({ id: `custom:${slug}-${Date.now().toString(36)}`, name: finalName, ...parsed })
    } catch (err) {
      setError(err instanceof ThemeImportError ? err.message : 'That theme could not be read.')
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">Import a theme</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          On tweakcn.com, pick or build a theme, press Code and copy the CSS. Any shadcn/ui theme works the same way
          (CSS variables or the theme JSON). Only colors and the corner radius are used.
        </p>
      </div>
      <div>
        <label htmlFor={nameId} className="sr-only">
          Theme name
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Name, for example Sunset"
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor={cssId} className="sr-only">
          Theme CSS
        </label>
        <textarea
          id={cssId}
          value={css}
          onChange={(e) => {
            setCss(e.target.value)
            setError(null)
          }}
          rows={8}
          spellCheck={false}
          placeholder={':root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.145 0 0);\n  ...\n}\n.dark {\n  ...\n}'}
          className={cn(fieldClass, 'resize-y font-mono text-xs leading-relaxed')}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <input ref={fileRef} type="file" accept=".css,.json,.txt,text/css,application/json,text/plain" onChange={onFile} className="hidden" />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp />
            From file
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!css.trim()}>
            Import
          </Button>
        </div>
      </div>
    </div>
  )
}
