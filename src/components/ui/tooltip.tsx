'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

function TooltipProvider({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // Base styling with premium glass effect
          'relative z-50 overflow-hidden rounded-lg px-3 py-2 text-xs font-medium text-black/90 dark:text-white/90',
          // Glass morphism background
          'bg-white/80 dark:bg-[oklch(0.18_0.015_25)]/80 backdrop-blur-xl',
          // Border with subtle glow
          'border border-rose-500/20 dark:border-rose-300/20',
          // Shadow effects
          'shadow-lg shadow-rose-500/10 dark:shadow-black/40',
          // Animation
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          // Transform origin
          'origin-[var(--radix-tooltip-content-transform-origin)]',
          className,
        )}
        {...props}
      >
        {/* Premium gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-500/10 dark:via-transparent dark:to-rose-500/15 pointer-events-none rounded-lg" />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 dark:to-white/5 pointer-events-none rounded-lg" />

        {/* Content */}
        <div className="relative z-10">{children}</div>

        {/* Arrow with matching styling */}
        <TooltipPrimitive.Arrow
          className="fill-white/80 dark:fill-[oklch(0.18_0.015_25)]/80 drop-shadow-sm"
          width={12}
          height={6}
        />

        {/* Premium glow effect */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-300/0 via-rose-300/10 to-rose-300/0 rounded-lg blur-xl opacity-0 dark:opacity-30 pointer-events-none" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
