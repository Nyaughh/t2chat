'use client'

import React from 'react'
import { cn } from '@/lib/utils'

/** Text input / textarea / select styling shared by the customization form fields. */
export const fieldClass =
  'w-full min-w-0 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20 dark:focus:border-rose-300/40 dark:focus:ring-rose-300/15'

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card/40">{children}</div>
    </section>
  )
}

/** One setting: label + description on the left, control on the right (stacks on narrow screens). */
export function Row({
  label,
  description,
  htmlFor,
  children,
  stacked = false,
}: {
  label: string
  description?: string
  htmlFor?: string
  children: React.ReactNode
  /** Put the control below the label at every width (for wide controls like grids). */
  stacked?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5',
        !stacked && 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
      )}
    >
      <div className="min-w-0 sm:flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : (
          <div className="text-sm font-medium text-foreground">{label}</div>
        )}
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn('min-w-0', !stacked && 'sm:shrink-0')}>{children}</div>
    </div>
  )
}

/** A compact single-choice control; wraps instead of overflowing on narrow screens. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: React.ReactNode; title?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {options.map((o) => {
        const checked = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-9 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150',
              checked
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Selectable tile (radio) used for font pickers. */
export function OptionTile({
  checked,
  onSelect,
  children,
  className,
  style,
  title,
}: {
  checked: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  title?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      title={title}
      style={style}
      className={cn(
        'flex min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150',
        checked
          ? 'border-rose-500/40 bg-rose-500/10 text-foreground ring-1 ring-rose-500/30 dark:border-rose-300/40 dark:bg-rose-300/10 dark:ring-rose-300/25'
          : 'border-border bg-background/40 text-foreground hover:bg-muted/60',
        className,
      )}
    >
      {children}
    </button>
  )
}
