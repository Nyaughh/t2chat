import { cn } from '@/lib/utils'
import { SettingsSidebarItem } from './SettingsSidebarItem'
import { type SettingsSection, settingsSections } from './config'

interface SettingsSidebarProps {
  settingsSections: typeof settingsSections
  activeSection: SettingsSection
  setActiveSection: (section: SettingsSection) => void
  isMobile: boolean
}

export function SettingsSidebar({
  settingsSections,
  activeSection,
  setActiveSection,
  isMobile,
}: SettingsSidebarProps) {
  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-card/20 backdrop-blur-sm',
        isMobile
          ? 'p-3 border-b border-border'
          : 'w-64 p-4 border-r border-border',
      )}
    >
      <nav
        className={cn(
          'flex',
          isMobile 
            ? 'flex-row space-x-2 overflow-x-auto scrollbar-hide pb-1' 
            : 'flex-col space-y-2'
        )}
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