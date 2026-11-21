'use client'

import React, { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppearance } from '@/components/theme/AppearanceProvider'
import {
  ACCENTS,
  CODE_FONTS,
  CODE_SIZES,
  DEFAULT_APPEARANCE,
  DENSITIES,
  FONTS,
  RADII,
  UI_SCALES,
} from '@/lib/theme/appearance'
import { OptionTile, Row, Section, Segmented } from './controls'
import { ThemePicker } from './ThemePicker'

const noopSubscribe = () => () => {}

const MODES = [
  { value: 'system', label: <ModeLabel icon={Monitor} text="System" /> },
  { value: 'light', label: <ModeLabel icon={Sun} text="Light" /> },
  { value: 'dark', label: <ModeLabel icon={Moon} text="Dark" /> },
] as const

function ModeLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  )
}

/** Theme, colors, fonts, sizes, density: every change applies instantly and is saved automatically. */
export function AppearanceSection() {
  const [appearance, update] = useAppearance()
  const { theme, setTheme, resolvedTheme } = useTheme()
  // next-themes only knows the mode on the client; render a neutral state until then.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const mode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light'
  const modeSetting = mounted ? (theme as 'system' | 'light' | 'dark' | undefined) : undefined
  const isDefault =
    appearance.themeId === DEFAULT_APPEARANCE.themeId &&
    appearance.accent === DEFAULT_APPEARANCE.accent &&
    appearance.font === DEFAULT_APPEARANCE.font &&
    appearance.codeFont === DEFAULT_APPEARANCE.codeFont &&
    appearance.uiScale === DEFAULT_APPEARANCE.uiScale &&
    appearance.codeSize === DEFAULT_APPEARANCE.codeSize &&
    appearance.density === DEFAULT_APPEARANCE.density &&
    appearance.radius === DEFAULT_APPEARANCE.radius

  const reset = () =>
    update({
      themeId: DEFAULT_APPEARANCE.themeId,
      accent: DEFAULT_APPEARANCE.accent,
      font: DEFAULT_APPEARANCE.font,
      codeFont: DEFAULT_APPEARANCE.codeFont,
      uiScale: DEFAULT_APPEARANCE.uiScale,
      codeSize: DEFAULT_APPEARANCE.codeSize,
      density: DEFAULT_APPEARANCE.density,
      radius: DEFAULT_APPEARANCE.radius,
    })

  return (
    <div className="space-y-8">
      <Section
        title="Appearance"
        description="Changes apply instantly and are saved automatically."
        action={
          <Button variant="ghost" size="sm" onClick={reset} disabled={isDefault}>
            <RotateCcw />
            Reset to default
          </Button>
        }
      >
        <Row label="Mode" description="Every theme has a light and a dark side. System follows your device.">
          <Segmented
            label="Color mode"
            value={modeSetting ?? 'system'}
            options={MODES}
            onChange={setTheme}
          />
        </Row>
        <Row
          label="Theme"
          description="Built-in themes, or import any theme from tweakcn.com / shadcn/ui."
          stacked
        >
          <ThemePicker appearance={appearance} update={update} mode={mode} setMode={setTheme} />
        </Row>
        <Row label="Accent color" description="Buttons, highlights and links. The first keeps the theme's own.">
          <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-1.5">
            {ACCENTS.map((accent) => {
              const checked = appearance.accent === accent.id
              return (
                <button
                  key={accent.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={accent.name}
                  title={accent.name}
                  onClick={() => update({ accent: accent.id })}
                  className={cn(
                    'flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow',
                    checked ? 'ring-2 ring-foreground' : 'hover:ring-1 hover:ring-muted-foreground',
                  )}
                >
                  {accent.swatch ? (
                    <span className="size-5 rounded-full" style={{ background: accent.swatch }} />
                  ) : (
                    <span className="size-4.5 rounded-full border-[1.5px] border-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        </Row>
        <Row label="Corner radius" description="How rounded cards, buttons and inputs are.">
          <Segmented
            label="Corner radius"
            value={appearance.radius}
            options={RADII.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(radius) => update({ radius })}
          />
        </Row>
      </Section>

      <Section title="Text and layout" description="Fonts and sizes for the whole app.">
        <Row label="Interface font" description="Used for menus and messages." stacked>
          <div role="radiogroup" aria-label="Interface font" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FONTS.map((font) => (
              <OptionTile
                key={font.id}
                checked={appearance.font === font.id}
                onSelect={() => update({ font: font.id })}
                style={{ fontFamily: font.stack }}
                title={font.name}
              >
                <span className="text-lg leading-tight">Aa</span>
                <span className="w-full truncate text-xs text-muted-foreground">{font.name}</span>
              </OptionTile>
            ))}
          </div>
        </Row>
        <Row label="Code font" description="Used for code blocks and inline code." stacked>
          <div role="radiogroup" aria-label="Code font" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CODE_FONTS.map((font) => (
              <OptionTile
                key={font.id}
                checked={appearance.codeFont === font.id}
                onSelect={() => update({ codeFont: font.id })}
                style={{ fontFamily: font.stack }}
                title={font.name}
              >
                <span className="text-sm leading-tight">{'{ } => 0O'}</span>
                <span className="w-full truncate text-xs text-muted-foreground">{font.name}</span>
              </OptionTile>
            ))}
          </div>
        </Row>
        <Row label="Interface size" description="Scales all text and controls.">
          <Segmented
            label="Interface size"
            value={appearance.uiScale}
            options={UI_SCALES.map((s) => ({ value: s, label: `${Math.round(s * 1000) / 10}%` }))}
            onChange={(uiScale) => update({ uiScale })}
          />
        </Row>
        <Row label="Code size" description="Font size inside code blocks.">
          <Segmented
            label="Code size"
            value={appearance.codeSize}
            options={CODE_SIZES.map((s) => ({ value: s, label: `${s}` }))}
            onChange={(codeSize) => update({ codeSize })}
          />
        </Row>
        <Row label="Density" description="Spacing between and inside elements.">
          <Segmented
            label="Density"
            value={appearance.density}
            options={DENSITIES.map((d) => ({ value: d.id, label: d.name }))}
            onChange={(density) => update({ density })}
          />
        </Row>
        <div className="px-4 py-4">
          <AppearancePreview />
        </div>
      </Section>
    </div>
  )
}

/** A small, live sample of chat UI in the current settings. */
function AppearancePreview() {
  return (
    <div aria-label="Preview" className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl border border-rose-500/15 bg-rose-500/10 px-3 py-2 text-sm text-foreground dark:border-rose-300/15 dark:bg-rose-300/10">
          How do I reverse a string?
        </div>
      </div>
      <div className="space-y-2 text-sm text-foreground">
        <p>
          Use <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">split</code>, then{' '}
          <span className="font-medium text-rose-600 dark:text-rose-300">reverse</span> and join:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[length:var(--app-code-size)] leading-relaxed">
          <code>{`const reversed = text.split('').reverse().join('')`}</code>
        </pre>
        <p className="text-xs text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
      </div>
    </div>
  )
}
