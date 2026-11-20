import { cn } from '@/lib/utils'
import { ItemHighlight } from '@/components/ui/item-highlight'

interface SettingsSidebarItemProps {
  section: {
    id: string
    label: string
    icon: React.ElementType
  }
  isActive: boolean
  onClick: () => void
  isMobile: boolean
}

// Abbreviated labels for mobile
const mobileLabels = {
  account: 'Account',
  models: 'Models',
  customize: 'Custom',
  speech: 'Speech',
  data: 'Data',
}

export function SettingsSidebarItem({ section, isActive, onClick, isMobile }: SettingsSidebarItemProps) {
  if (isMobile) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-lg p-2 cursor-pointer transition-colors duration-150',
          isActive
            ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300'
            : 'text-muted-foreground hover:bg-rose-500/5 hover:text-rose-600 dark:hover:bg-rose-300/5 dark:hover:text-rose-300',
        )}
      >
        <section.icon className="size-4" />
        <span className="text-xs font-medium leading-none">
          {mobileLabels[section.id as keyof typeof mobileLabels] || section.label}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-2.5 overflow-hidden px-3 py-2.5 text-left cursor-pointer transition-colors duration-150 ease-[0.25,1,0.5,1]',
        isActive
          ? 'text-rose-600 dark:text-rose-300'
          : 'text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300',
      )}
    >
      <ItemHighlight active={isActive} />
      <section.icon className="relative z-10 size-4" />
      <span className="relative z-10 text-sm">{section.label}</span>
    </button>
  )
}
