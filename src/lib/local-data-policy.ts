// Pure rules for who owns the chats kept in this browser's IndexedDB.
// No imports, so the rules can be unit-tested in plain Node.
//
// IndexedDB only holds guest (signed-out) chats. Signed-in chats live in Convex
// and are never copied here. On a shared browser, guest chats that are still on
// the device while someone is signed in count as that person's: they can import
// them, and when their session ends (sign-out, expiry, or another account
// signing in) the local chats are wiped so the next person can't see them.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Guest chats and messages always get uuid v4 ids. Convex ids never match this
 * pattern, so any row that isn't a UUID is a stale copy of a signed-in user's
 * server data (older builds mirrored Convex into IndexedDB).
 */
export const isGuestLocalId = (id: unknown): boolean => typeof id === 'string' && UUID_RE.test(id)

export type LocalSessionState =
  | { status: 'pending' }
  // The session check failed (for example offline). We can't tell who is here.
  | { status: 'unknown' }
  | { status: 'signed-in'; userId: string }
  | { status: 'signed-out' }

export interface LocalDataDecision {
  /** Wipe the local chats before showing anything. */
  clear: boolean
  /** New owner to record. `undefined` leaves the stored owner unchanged. */
  nextOwner: string | null | undefined
  /** Whether local chats may be shown in this state (after `clear`, if set). */
  visible: boolean
}

export function decideLocalDataOwner(storedOwner: string | null, session: LocalSessionState): LocalDataDecision {
  switch (session.status) {
    case 'pending':
    case 'unknown':
      // If a signed-in user owned the local data, keep it hidden until we know
      // whether that user is still here. Never clear on an unknown state: it
      // could be a network blip, and clearing would lose their guest chats.
      return { clear: false, nextOwner: undefined, visible: storedOwner === null }
    case 'signed-in':
      return {
        clear: storedOwner !== null && storedOwner !== session.userId,
        nextOwner: session.userId,
        visible: true,
      }
    case 'signed-out':
      return { clear: storedOwner !== null, nextOwner: null, visible: true }
  }
}

/** Stable key for a session state, used to discard results computed for an older state. */
export const localSessionKey = (session: LocalSessionState): string =>
  session.status === 'signed-in' ? `signed-in:${session.userId}` : session.status
