import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:bg-rose-300/10 dark:text-rose-300 dark:hover:bg-rose-300/20',
        destructive:
          'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30',
        outline:
          'bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 dark:bg-rose-300/5 dark:text-rose-300 dark:hover:bg-rose-300/10',
        secondary:
          'bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 dark:bg-rose-300/5 dark:text-rose-300 dark:hover:bg-rose-300/10',
        ghost:
          'text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/5 dark:text-rose-300/70 dark:hover:text-rose-300 dark:hover:bg-rose-300/5',
        link: 'text-rose-500/70 hover:text-rose-600 dark:text-rose-300/70 dark:hover:text-rose-300 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
