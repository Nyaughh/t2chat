'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * "Display your name / email" privacy toggles from Account settings. Stored per browser in
 * localStorage (same keys as before) and shared live between the settings pane and the
 * sidebar profile, so flipping a toggle masks the value everywhere straight away.
 */
const KEYS = { showName: 'privacy-show-name', showEmail: 'privacy-show-email' } as const
type PrivacyPref = keyof typeof KEYS

const CHANGE_EVENT = 't2chat:privacy-prefs'

function read(pref: PrivacyPref): boolean {
  try {
    const saved = localStorage.getItem(KEYS[pref])
    return saved !== null ? saved === 'true' : true
  } catch {
    return true
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || Object.values(KEYS).includes(e.key as (typeof KEYS)[PrivacyPref])) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export function usePrivacyPref(pref: PrivacyPref): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(pref),
    () => true,
  )

  const setValue = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(KEYS[pref], String(next))
      } catch {
        // Storage unavailable (private mode); the toggle just won't persist
      }
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    [pref],
  )

  return [value, setValue]
}

export const MASKED_NAME = '••••••••'
export const MASKED_EMAIL = '••••••••••••••••'
