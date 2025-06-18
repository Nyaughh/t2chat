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
          ? 'px-2 py-3 border-b border-border'
          : 'w-64 p-4 border-r border-border',
      )}
    >
      <nav
        className={cn(
          isMobile 
            ? 'grid grid-cols-5 gap-1' 
            : 'flex flex-col space-y-2'
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