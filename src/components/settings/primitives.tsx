import type React from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight building blocks for settings panes: a titled group of hairline-divided rows,
 * in the style of desktop chat app settings. Keeps every pane on the same spacing scale.
 */

/** Text input / textarea / select styling shared by every settings form field. */
export const settingsFieldClass =
  'w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-[border-color,box-shadow] duration-150 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/15 dark:focus:border-rose-300/35 dark:focus:ring-rose-300/10'

export function SettingsGroup({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      {(title || description || action) && (
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-medium text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** A bordered card whose direct children are separated by hairlines. */
export function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border/70 rounded-lg border border-border/70', className)}>{children}</div>
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  icon: Icon,
  children,
  className,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  htmlFor?: string
  icon?: React.ElementType
  children?: React.ReactNode
  className?: string
}) {
  const LabelTag = htmlFor ? 'label' : 'div'
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4 px-3 py-2', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <LabelTag htmlFor={htmlFor} className="block text-sm text-foreground">
            {label}
          </LabelTag>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  )
}
