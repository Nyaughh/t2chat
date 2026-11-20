// Pure rules for who owns the chats kept in this browser's IndexedDB.
// No runtime imports, so the rules can be unit-tested in plain Node.
//
// IndexedDB only holds local (guest) chats. Signed-in chats live in Convex and
// are never copied here. Each local conversation row records its owner in
// `userId`, and that ownership changes only inside Dexie transactions:
// - no `userId`: an unowned guest chat, shown in the signed-out view.
// - `userId` set: claimed by that signed-in user (they saw it and can import
//   it). It is never shown to a guest or another account, and it is deleted
//   once that user's session is confirmed to have ended, or another account
//   signs in.
// - `userId` plus `legacyOwner`: written by an older client (acd4812) while that
//   user was signed in. We never saw that session end, so the row is hidden but
//   kept until the same user signs in (who then owns it) or another account
//   signs in (it is deleted).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Local chats and messages always get uuid v4 ids. Convex ids never match this
 * pattern, so any row that isn't a UUID is a stale copy of a signed-in user's
 * server data (older builds mirrored Convex into IndexedDB).
 */
export const isGuestLocalId = (id: unknown): boolean => typeof id === 'string' && UUID_RE.test(id)

/** `userId` value the acd4812 client wrote for chats created while signed out. */
export const LEGACY_GUEST_OWNER = 'local-user'

export type LocalSessionState =
  | { status: 'pending' }
  // The session check failed (for example offline). We can't tell who is here.
  | { status: 'unknown' }
  | { status: 'signed-in'; userId: string }
  | { status: 'signed-out' }

/** Map a Better Auth `useSession()` / `getSession()` result to a session state. */
export function sessionStateFrom(auth: {
  data?: { user?: { id?: string | null } | null } | null
  isPending?: boolean
  error?: unknown
}): LocalSessionState {
  const userId = auth.data?.user?.id
  if (userId) return { status: 'signed-in', userId }
  if (auth.isPending) return { status: 'pending' }
  if (auth.error) return { status: 'unknown' }
  return { status: 'signed-out' }
}

/** Stable key for a session state, used to discard results computed for an older state. */
export const localSessionKey = (session: LocalSessionState): string =>
  session.status === 'signed-in' ? `signed-in:${session.userId}` : session.status

export const sameSession = (a: LocalSessionState, b: LocalSessionState) => localSessionKey(a) === localSessionKey(b)

export interface OwnedRow {
  id: string
  userId?: string
  legacyOwner?: boolean
}

export interface OwnershipPlan {
  deleteConversationIds: string[]
  claimConversationIds: string[]
}

/** What to delete and claim so the local rows match the current session. */
export function planOwnershipSync(rows: ReadonlyArray<OwnedRow>, session: LocalSessionState): OwnershipPlan {
  const plan: OwnershipPlan = { deleteConversationIds: [], claimConversationIds: [] }
  if (session.status === 'signed-out') {
    // The session we saw has ended: wipe what that user claimed. Legacy rows
    // are kept (hidden): we never saw their owner's session end.
    for (const row of rows) if (row.userId && !row.legacyOwner) plan.deleteConversationIds.push(row.id)
  } else if (session.status === 'signed-in') {
    for (const row of rows) {
      if (row.userId && row.userId !== session.userId) plan.deleteConversationIds.push(row.id)
      else if (!row.userId || row.legacyOwner) plan.claimConversationIds.push(row.id)
    }
  }
  // pending / unknown: never change anything.
  return plan
}

export const isEmptyPlan = (plan: OwnershipPlan) =>
  plan.deleteConversationIds.length === 0 && plan.claimConversationIds.length === 0

/**
 * Whether a local conversation may be shown. Signed-in users see their own rows
 * and still-unclaimed guest rows (to import them). Everyone else, including a
 * pending or unknown session, sees unowned guest rows only.
 */
export function isLocalRowVisible(row: { userId?: string }, viewer: LocalSessionState): boolean {
  if (viewer.status === 'signed-in') return !row.userId || row.userId === viewer.userId
  return !row.userId
}

/** Guest writes are only allowed into an existing, unowned conversation. */
export const isGuestWritable = (row: { userId?: string } | undefined | null): boolean => !!row && !row.userId

/** True when every chat in the list belongs to `userId` (an empty list trivially does). */
export const chatsBelongTo = (chats: ReadonlyArray<{ userId: string }>, userId: string) =>
  chats.every((chat) => chat.userId === userId)

// ---------------------------------------------------------------------------
// One-time cleanup of data written by older clients (Dexie v4 upgrade).

export interface LegacyConversation extends OwnedRow {
  title?: string
  createdAt?: Date
  updatedAt?: Date
  lastMessageAt?: Date
  [key: string]: unknown
}

export interface LegacyMessage {
  id: string
  conversationId: string
  createdAt?: Date
  [key: string]: unknown
}

export interface LegacyCleanupPlan {
  deleteConversationIds: string[]
  deleteMessageIds: string[]
  /** Conversations to write back (normalized ownership, or new recovered chats). */
  putConversations: LegacyConversation[]
  /** Local messages to move into a recovered conversation. */
  moveMessages: Array<{ id: string; conversationId: string }>
}

export const RECOVERED_CHAT_TITLE = 'Recovered chat'

/**
 * - Drops copies of server chats and messages (non-UUID ids).
 * - Older builds let a signed-out visitor open a copied server chat and send
 *   messages into it. Those local (UUID) messages only exist here, so they are
 *   moved to a fresh, unowned local conversation, without the copied title.
 * - Normalizes acd4812 ownership: 'local-user' becomes unowned, a real user id
 *   becomes a legacy-owned row.
 */
export function planLegacyCleanup(
  conversations: ReadonlyArray<LegacyConversation>,
  messages: ReadonlyArray<LegacyMessage>,
  createId: () => string,
): LegacyCleanupPlan {
  const plan: LegacyCleanupPlan = {
    deleteConversationIds: [],
    deleteMessageIds: [],
    putConversations: [],
    moveMessages: [],
  }

  for (const conv of conversations) {
    if (!isGuestLocalId(conv.id)) {
      plan.deleteConversationIds.push(conv.id)
      continue
    }
    if (conv.userId === LEGACY_GUEST_OWNER) {
      const { userId: _drop, legacyOwner: _legacy, ...rest } = conv
      plan.putConversations.push({ ...rest })
    } else if (conv.userId && !conv.legacyOwner) {
      plan.putConversations.push({ ...conv, legacyOwner: true })
    }
  }

  const recovered = new Map<string, LegacyConversation>()
  for (const msg of messages) {
    if (!isGuestLocalId(msg.id)) {
      plan.deleteMessageIds.push(msg.id)
      continue
    }
    if (isGuestLocalId(msg.conversationId)) continue

    let target = recovered.get(msg.conversationId)
    const at = msg.createdAt instanceof Date ? msg.createdAt : new Date(0)
    if (!target) {
      target = { id: createId(), title: RECOVERED_CHAT_TITLE, createdAt: at, updatedAt: at, lastMessageAt: at }
      recovered.set(msg.conversationId, target)
    } else {
      if (at < (target.createdAt as Date)) target.createdAt = at
      if (at > (target.updatedAt as Date)) target.updatedAt = target.lastMessageAt = at
    }
    plan.moveMessages.push({ id: msg.id, conversationId: target.id })
  }
  plan.putConversations.push(...recovered.values())
  return plan
}

// ---------------------------------------------------------------------------
// Ownership sync sequence (the storage side is injected; see local-data.ts).

export type OwnershipSyncOutcome = 'skipped' | 'unconfirmed' | 'applied'

/**
 * Changes ownership only for a definite session (signed in or signed out), only
 * if there is something to change, and only after the server confirms the same
 * session again. A stale in-memory session (another tab just signed in or out)
 * therefore never deletes or claims rows.
 */
export async function runOwnershipSync(
  session: LocalSessionState,
  deps: {
    readRows: () => Promise<ReadonlyArray<OwnedRow>>
    confirm: () => Promise<LocalSessionState>
    apply: (session: LocalSessionState) => Promise<void>
  },
): Promise<OwnershipSyncOutcome> {
  if (session.status !== 'signed-in' && session.status !== 'signed-out') return 'skipped'
  if (isEmptyPlan(planOwnershipSync(await deps.readRows(), session))) return 'skipped'
  if (!sameSession(await deps.confirm(), session)) return 'unconfirmed'
  await deps.apply(session)
  return 'applied'
}

/**
 * Holds where writes may go. `wait()` resolves once a mode is known and never
 * resolves with "undecided", so a send made while the session is still being
 * checked is delayed, not dropped.
 */
export function createModeGate<T>() {
  let mode: T | null = null
  const waiters = new Set<(mode: T) => void>()
  return {
    set(next: T | null) {
      mode = next
      if (next !== null) {
        const ready = [...waiters]
        waiters.clear()
        ready.forEach((resolve) => resolve(next))
      }
    },
    get: () => mode,
    wait(): Promise<T> {
      return mode !== null ? Promise.resolve(mode) : new Promise<T>((resolve) => waiters.add(resolve))
    },
  }
}
