/**
 * Client-side home of the appearance preferences.
 *
 * The device keeps a guest copy (shown when signed out) and one account copy
 * tagged with the account that owns it (see sync.ts). Whichever is active is
 * applied live by rewriting one <style> element, and its variables are cached
 * for the pre-paint boot script. AppearanceProvider decides which copy is
 * active from the auth state and mirrors account copies to Convex.
 */

import {
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_STYLE_ID,
  APPEARANCE_VARS_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  computeVars,
  legacyCookieFonts,
  sanitizeAppearance,
  varsToCss,
  type Appearance,
} from './appearance'
import type { AccountCopy } from './sync'

/** The account copy and which copy is active. (The guest copy keeps the original key.) */
export const APPEARANCE_ACCOUNT_STORAGE_KEY = 't2chat-appearance-account'
export const APPEARANCE_ACTIVE_STORAGE_KEY = 't2chat-appearance-active'
export const APPEARANCE_STORAGE_KEYS = [
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_ACCOUNT_STORAGE_KEY,
  APPEARANCE_ACTIVE_STORAGE_KEY,
]

const OWNER_RE = /^[A-Za-z0-9_-]{1,64}$/

type State = {
  guest: Appearance
  account: AccountCopy | null
  /** Owner id of the active account copy, or null for the guest copy. */
  active: string | null
  displayed: Appearance
}

let state: State | null = null
const listeners = new Set<() => void>()

const read = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or disabled: the page still updates, it just won't survive a reload.
  }
}

function load(): State {
  let guest: Appearance
  const storedGuest = read(APPEARANCE_STORAGE_KEY)
  if (storedGuest) {
    guest = sanitizeAppearance(storedGuest)
  } else {
    // First run of the appearance engine on this device: carry over the old
    // font cookies (known ids only). Never stamped, so it never wins over or is
    // pushed into an account's own settings.
    guest = { ...DEFAULT_APPEARANCE, ...legacyCookieFonts(document.cookie), updatedAt: 0 }
    write(APPEARANCE_STORAGE_KEY, guest)
  }

  const storedAccount = read(APPEARANCE_ACCOUNT_STORAGE_KEY) as { owner?: unknown; appearance?: unknown } | null
  const account =
    storedAccount && typeof storedAccount.owner === 'string' && OWNER_RE.test(storedAccount.owner)
      ? { owner: storedAccount.owner, appearance: sanitizeAppearance(storedAccount.appearance) }
      : null

  const storedActive = read(APPEARANCE_ACTIVE_STORAGE_KEY)
  const active = account && storedActive === account.owner ? account.owner : null
  return { guest, account, active, displayed: active ? account!.appearance : guest }
}

const current = (): State => (state ??= load())

export function getAppearanceSnapshot(): Appearance {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  return current().displayed
}

export function getServerAppearanceSnapshot(): Appearance {
  return DEFAULT_APPEARANCE
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getGuestAppearance = () => current().guest
export const getAccountCopy = () => current().account
export const getActiveOwner = () => current().active

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
  write(APPEARANCE_VARS_STORAGE_KEY, vars)
}

function display(next: Appearance) {
  const s = current()
  const changed = s.displayed !== next
  s.displayed = next
  applyAppearance(next)
  if (changed) listeners.forEach((l) => l())
}

/** A user-initiated change to whichever copy is active; stamped so it wins over older copies. */
export function updateAppearance(patch: Partial<Appearance> | ((prev: Appearance) => Partial<Appearance>)) {
  const s = current()
  const prev = s.displayed
  const changes = typeof patch === 'function' ? patch(prev) : patch
  const next = sanitizeAppearance({ ...prev, ...changes, updatedAt: Math.max(Date.now(), prev.updatedAt + 1) })
  if (s.active && s.account?.owner === s.active) {
    s.account = { owner: s.active, appearance: next }
    write(APPEARANCE_ACCOUNT_STORAGE_KEY, s.account)
  } else {
    s.guest = next
    write(APPEARANCE_STORAGE_KEY, next)
  }
  display(next)
}

/** Makes `owner`'s copy the active one (replacing any other account's cached copy). */
export function showAccount(owner: string, appearance: Appearance) {
  if (!OWNER_RE.test(owner)) return
  const s = current()
  const clean = sanitizeAppearance(appearance)
  s.account = { owner, appearance: clean }
  s.active = owner
  write(APPEARANCE_ACCOUNT_STORAGE_KEY, s.account)
  write(APPEARANCE_ACTIVE_STORAGE_KEY, owner)
  display(clean)
}

/** Signed out: show the guest copy. The account copy stays cached for its owner only. */
export function showGuest() {
  const s = current()
  if (s.active === null && s.displayed === s.guest) return
  s.active = null
  write(APPEARANCE_ACTIVE_STORAGE_KEY, null)
  display(s.guest)
}

/** Picks up changes made in another tab. */
export function reloadFromStorage() {
  state = load()
  applyAppearance(state.displayed)
  listeners.forEach((l) => l())
}
