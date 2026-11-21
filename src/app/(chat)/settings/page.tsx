'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ChatInterface from '@/app/(chat)/_components/ChatInterface'
import { useAuth } from '@/hooks/useAuth'
import { useSettingsDialog } from '@/components/settings/SettingsDialogProvider'
import { parseSettingsSection } from '@/components/settings/config'

/**
 * Settings is a dialog now. /settings (and /settings?tab=<section>) stays as a link target
 * for bookmarks and old links: it opens the dialog on the requested section over a new chat
 * and swaps the URL to "/".
 */
function SettingsRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn, isPending } = useAuth()
  const { openSettings } = useSettingsDialog()
  const handled = useRef(false)

  useEffect(() => {
    if (isPending || handled.current) return
    handled.current = true

    if (isSignedIn) {
      openSettings(parseSettingsSection(searchParams.get('tab')) ?? undefined)
    }
    router.replace('/')
  }, [isPending, isSignedIn, searchParams, openSettings, router])

  return null
}

export default function SettingsPage() {
  return (
    <>
      <ChatInterface />
      <Suspense fallback={null}>
        <SettingsRedirect />
      </Suspense>
    </>
  )
}
