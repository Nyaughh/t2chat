import React from 'react'
import { User, Mail } from 'lucide-react'
import { Switch } from '../ui/switch'
import { MASKED_EMAIL, MASKED_NAME, usePrivacyPref } from '@/hooks/usePrivacyPrefs'
import { SettingsCard, SettingsGroup, SettingsRow } from './primitives'

interface AccountSettingsProps {
  user: {
    name: string
    email: string
    image: string
  }
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const [showName, setShowName] = usePrivacyPref('showName')
  const [showEmail, setShowEmail] = usePrivacyPref('showEmail')
  const initial = (user.name || user.email || '?')[0]?.toUpperCase()

  return (
    <div className="space-y-6">
      <SettingsGroup title="Profile">
        <SettingsCard>
          <div className="flex items-center gap-3 px-3 py-3">
            {user.image ? (
              // Plain <img>: avatars come from several OAuth hosts that next/image isn't configured for
              <img src={user.image} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-sm font-medium text-rose-600 dark:bg-rose-300/10 dark:text-rose-300"
              >
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {showName ? user.name || 'No name set' : MASKED_NAME}
              </div>
              <div className="truncate text-xs text-muted-foreground">{showEmail ? user.email : MASKED_EMAIL}</div>
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Privacy"
        description="Hide your details on screen, e.g. while sharing it. Applies to this browser."
      >
        <SettingsCard>
          <SettingsRow
            icon={User}
            label="Display your name"
            description="Show your name in the sidebar and here."
            htmlFor="privacy-show-name"
          >
            <Switch id="privacy-show-name" checked={showName} onCheckedChange={setShowName} />
          </SettingsRow>
          <SettingsRow
            icon={Mail}
            label="Display your email"
            description="Show your email in the sidebar and here."
            htmlFor="privacy-show-email"
          >
            <Switch id="privacy-show-email" checked={showEmail} onCheckedChange={setShowEmail} />
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>
    </div>
  )
}
