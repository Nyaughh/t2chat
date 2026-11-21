/**
 * Client-side home of the appearance preferences.
 *
 * localStorage is the source of truth on this device (guests and the pre-paint
 * boot script use it); AppearanceProvider mirrors it to Convex for signed-in
 * users. Every change is applied live by rewriting one <style> element.
 */

import {
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_STYLE_ID,
  APPEARANCE_VARS_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  computeVars,
  sanitizeAppearance,
  varsToCss,
  type Appearance,
} from './appearance'

let current: Appearance | null = null
const listeners = new Set<() => void>()

function readStorage(): Appearance {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return raw ? sanitizeAppearance(JSON.parse(raw)) : DEFAULT_APPEARANCE
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function getAppearanceSnapshot(): Appearance {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  return (current ??= readStorage())
}

export function getServerAppearanceSnapshot(): Appearance {
  return DEFAULT_APPEARANCE
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Writes the variables to the page (and the boot-script snapshot). */
export function applyAppearance(appearance: Appearance) {
  if (typeof document === 'undefined') return
  const vars = computeVars(appearance)
  const css = varsToCss(vars)
  let el = document.getElementById(APPEARANCE_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = APPEARANCE_STYLE_ID
    document.head.appendChild(el)
  }
  if (el.textContent !== css) el.textContent = css
  try {
    window.localStorage.setItem(APPEARANCE_VARS_STORAGE_KEY, JSON.stringify(vars))
  } catch {
    // Storage full or disabled: the page still updates, it just won't survive a reload.
  }
}

export function setAppearance(next: Appearance) {
  const clean = sanitizeAppearance(next)
  current = clean
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(clean))
  } catch {
    // See applyAppearance.
  }
  applyAppearance(clean)
  listeners.forEach((l) => l())
}

/** A user-initiated change: stamps `updatedAt` so it wins over older copies elsewhere. */
export function updateAppearance(patch: Partial<Appearance> | ((prev: Appearance) => Partial<Appearance>)) {
  const prev = getAppearanceSnapshot()
  const changes = typeof patch === 'function' ? patch(prev) : patch
  setAppearance({ ...prev, ...changes, updatedAt: Math.max(Date.now(), prev.updatedAt + 1) })
}

/** Picks up changes made in another tab. */
export function reloadFromStorage() {
  current = readStorage()
  applyAppearance(current)
  listeners.forEach((l) => l())
}
