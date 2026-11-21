/**
 * How this device's appearance copies reconcile with an account's server copy.
 * Pure (no DOM, no Convex) so it can be reasoned about and tested on its own.
 *
 * The device keeps two copies:
 * - `guest`: what is shown when signed out (also the legacy-cookie migration target).
 * - `account`: the copy last used by one specific account (`owner` = its user id).
 *
 * Preferences never move from one account to another: a cached account copy is
 * only ever compared with (and pushed to) the account that owns it.
 */

import { DEFAULT_APPEARANCE, type Appearance } from './appearance'

export type AccountCopy = { owner: string; appearance: Appearance }

export type ReconcileInput = {
  userId: string
  /** The device's cached account copy, whoever it belongs to. */
  account: AccountCopy | null
  guest: Appearance
  /** The account's server copy (sanitized), or null if it never saved one. */
  server: Appearance | null
  /** Font choices from the account's pre-appearance settings columns. */
  legacy: Partial<Appearance>
}

export type ReconcileResult = {
  /** What to show and cache for this account. */
  appearance: Appearance
  /** Whether `appearance` should be saved to this account. */
  push: boolean
}

export function reconcile({ userId, account, guest, server, legacy }: ReconcileInput): ReconcileResult {
  const local = account && account.owner === userId ? account.appearance : null

  if (local && server) {
    // Same account on both sides: the newest change wins.
    return local.updatedAt > server.updatedAt ? { appearance: local, push: true } : { appearance: server, push: false }
  }
  if (server) return { appearance: server, push: false }
  if (local) return { appearance: local, push: local.updatedAt > 0 }

  // First time this account is seen with no saved appearance. Explicit edits made
  // while signed out on this device carry over; that is the user's own choice here.
  if (guest.updatedAt > 0) return { appearance: guest, push: true }

  // Nothing saved anywhere: keep the old font settings (the account's columns,
  // else this device's legacy cookies, which the guest copy holds), shown but not
  // saved, so cookie values are never written into an account.
  return {
    appearance: { ...DEFAULT_APPEARANCE, font: guest.font, codeFont: guest.codeFont, ...legacy, updatedAt: 0 },
    push: false,
  }
}
