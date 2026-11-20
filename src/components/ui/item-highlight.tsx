import { cn } from '@/lib/utils'

/**
 * The T2Chat list-row highlight: a soft rose gradient band with hairline top and bottom edges.
 * Used for chat history rows, settings navigation, the model picker, and command palette items.
 *
 * Place it as the first child of a `relative overflow-hidden group` row and give the row's
 * content `relative z-10`. When `active` is false the highlight only shows on hover.
 */
export function ItemHighlight({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 transition-opacity duration-150 ease-[0.25,1,0.5,1]',
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100',
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 to-transparent dark:via-rose-300/8" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent dark:via-rose-300/30" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent dark:via-rose-300/30" />
      <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 bg-gradient-to-r from-transparent via-rose-500/5 to-transparent blur-sm dark:via-rose-300/5" />
    </div>
  )
}
