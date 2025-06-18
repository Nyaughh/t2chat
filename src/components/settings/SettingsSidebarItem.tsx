import { cn } from '@/lib/utils'
import { type SettingsSection } from './config'

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
      <div
        onClick={onClick}
        className={cn(
          'flex flex-col items-center justify-center p-2 cursor-pointer transition-all duration-200 rounded-lg',
          'min-h-[60px] gap-1',
          isActive
            ? 'text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30'
            : 'text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300 hover:bg-muted/30',
        )}
      >
        <section.icon className="w-4 h-4" />
        <span className="text-xs font-medium leading-none">
          {mobileLabels[section.id as keyof typeof mobileLabels] || section.label}
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group px-3 py-2.5 cursor-pointer transition-all duration-150 ease-[0.25,1,0.5,1] relative overflow-hidden flex items-center gap-2.5',
        isActive
          ? 'text-rose-600 dark:text-rose-300'
          : 'hover:text-rose-600 dark:hover:text-rose-300 text-muted-foreground',
        'w-full text-left',
      )}
    >
      {/* Premium background for active state - matching chat history */}
      {isActive && (
        <>
          {/* Main gradient background with sharp edges */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>

          {/* Top shadow lighting */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

          {/* Bottom shadow lighting */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>

          {/* Premium inner glow */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
        </>
      )}

      {/* Hover effect for non-active items */}
      {!isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/3 dark:via-rose-300/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"></div>
      )}
      
      {/* Icon */}
      <section.icon className="w-4 h-4 relative z-10" />
      
      {/* Label */}
      <span className="text-sm relative z-10">
        {section.label}
      </span>
    </div>
  )
} 