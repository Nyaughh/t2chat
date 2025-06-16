import { cn } from '@/lib/utils'
import { type SettingsSection, settingsSections } from '../SettingsPage'
import { SettingsSidebarItem } from './SettingsSidebarItem'

interface SettingsSidebarProps {
  activeSection: SettingsSection
  setActiveSection: (section: SettingsSection) => void
  isMobile: boolean
}

export function SettingsSidebar({ activeSection, setActiveSection, isMobile }: SettingsSidebarProps) {
  return (
    <aside
      className={cn(
        'flex-shrink-0',
        isMobile
          ? 'p-2 border-b border-black/10 dark:border-white/10'
          : 'w-56 p-4 border-r border-black/10 dark:border-white/10',
      )}
    >
      <nav
        className={cn('flex', isMobile ? 'flex-row space-x-1 overflow-x-auto scrollbar-hide' : 'flex-col space-y-1')}
      >
        {settingsSections.map((section) => (
          <SettingsSidebarItem
            key={section.id}
            section={section}
            isActive={activeSection === section.id}
            onClick={() => setActiveSection(section.id as SettingsSection)}
            isMobile={isMobile}
          />
        ))}
      </nav>
    </aside>
  )
} 