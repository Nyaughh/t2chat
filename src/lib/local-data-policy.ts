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

/**
 * Map a Better Auth `useSession()` / `getSession()` result to a session state.
 * Only an explicit `null` payload with no error counts as signed out. A payload
 * that is present but carries no user id is treated as unknown.
 */
export function sessionStateFrom(auth: {
  data?: { user?: { id?: string | null } | null } | null
  isPending?: boolean
  error?: unknown
}): LocalSessionState {
  const userId = auth.data?.user?.id
  if (userId) return { status: 'signed-in', userId }
  if (auth.isPending) return { status: 'pending' }
  if (auth.error) return { status: 'unknown' }
  if (auth.data === null) return { status: 'signed-out' }
  return { status: 'unknown' }
}

/** Stable key for a session state, used to discard results computed for an older state. */
export const localSessionKey = (session: LocalSessionState): string =>
  session.status === 'signed-in' ? `signed-in:${session.userId}` : session.status

export const sameSession = (a: LocalSessionState, b: LocalSessionState) => localSessionKey(a) === localSessionKey(b)

export interface OwnedRow {
  id: string
  userId?: string
  legacyOwner?: boolean
  /** Guest replies still being written into this chat, in any tab (see reply leases below). */
  inFlight?: ReplyLeases
}

// ---------------------------------------------------------------------------
// Reply leases: a durable, cross-tab "a guest reply is still being written
// here" marker on the conversation row. A streaming reply buffers up to
// GUEST_PERSIST_INTERVAL_MS of text in memory, so until its final write lands
// the stored message can be behind what was shown. While a lease is active the
// chat is not offered for import (it is an import barrier only: ownership
// wipes on sign-out, expiry or account switch never wait for it). A lease is
// set with the reply's placeholder, renewed on every write (including the
// heartbeat checkpoint), released after the reply's last write, and expires on
// its own if the tab that holds it dies.

/** messageId -> lease expiry (epoch ms). */
export type ReplyLeases = Record<string, number>

export const REPLY_LEASE_MS = 30_000
export const REPLY_LEASE_RENEW_MS = 10_000

/** True while any reply lease on the row has not expired. */
export const hasActiveReply = (row: { inFlight?: ReplyLeases }, now: number): boolean =>
  !!row.inFlight && Object.values(row.inFlight).some((until) => until > now)

/** Earliest expiry of an active lease on any row, or null. */
export function nextLeaseExpiry(rows: ReadonlyArray<{ inFlight?: ReplyLeases }>, now: number): number | null {
  let next: number | null = null
  for (const row of rows) {
    for (const until of Object.values(row.inFlight ?? {})) {
      if (until > now && (next === null || until < next)) next = until
    }
  }
  return next
}

/** Leases with `messageId` set to `until`; expired leases are dropped. */
export function withLease(leases: ReplyLeases | undefined, messageId: string, until: number, now: number): ReplyLeases {
  const next: ReplyLeases = {}
  for (const [id, expiry] of Object.entries(leases ?? {})) if (expiry > now) next[id] = expiry
  next[messageId] = until
  return next
}

/** Leases without `messageId` (and without expired ones); undefined when none remain. */
export function withoutLease(leases: ReplyLeases | undefined, messageId: string, now: number): ReplyLeases | undefined {
  const next: ReplyLeases = {}
  for (const [id, expiry] of Object.entries(leases ?? {})) if (id !== messageId && expiry > now) next[id] = expiry
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * Local chats a signed-in user may import now: theirs (claim committed), not
 * already on the server, and with no guest reply still being written in any
 * tab, so the import never copies a message before its final text is stored.
 */
export function importableLocalChats<T extends OwnedRow>(
  rows: ReadonlyArray<T>,
  viewer: LocalSessionState,
  serverChatIds: ReadonlySet<string>,
  now: number,
): T[] {
  return rows.filter((row) => isLocalRowVisible(row, viewer) && !serverChatIds.has(row.id) && !hasActiveReply(row, now))
}

/**
 * Rows to delete and claim, each recorded with the ownership state it had when
 * the plan was made. Applying a plan only touches rows that still have exactly
 * that state (compare-and-set), so a plan made for an older session can never
 * undo a newer transition, for example another tab signing in and claiming
 * rows while this tab waited for the server.
 */
export interface OwnershipPlan {
  deletions: OwnedRow[]
  claims: OwnedRow[]
}

const observed = (row: OwnedRow): OwnedRow => ({
  id: row.id,
  ...(row.userId !== undefined ? { userId: row.userId } : {}),
  ...(row.legacyOwner ? { legacyOwner: true } : {}),
})

/** What to delete and claim so the local rows match the current session. */
export function planOwnershipSync(rows: ReadonlyArray<OwnedRow>, session: LocalSessionState): OwnershipPlan {
  const plan: OwnershipPlan = { deletions: [], claims: [] }
  if (session.status === 'signed-out') {
    // The session we saw has ended: wipe what that user claimed. Legacy rows
    // are kept (hidden): we never saw their owner's session end.
    for (const row of rows) if (row.userId && !row.legacyOwner) plan.deletions.push(observed(row))
  } else if (session.status === 'signed-in') {
    for (const row of rows) {
      if (row.userId && row.userId !== session.userId) plan.deletions.push(observed(row))
      else if (!row.userId || row.legacyOwner) plan.claims.push(observed(row))
    }
  }
  // pending / unknown: never change anything.
  return plan
}

export const isEmptyPlan = (plan: OwnershipPlan) => plan.deletions.length === 0 && plan.claims.length === 0

/** True when `current` still has exactly the ownership state recorded in `expected`. */
export const rowStillMatches = (current: OwnedRow | undefined | null, expected: OwnedRow): boolean =>
  !!current &&
  current.id === expected.id &&
  (current.userId ?? null) === (expected.userId ?? null) &&
  !!current.legacyOwner === !!expected.legacyOwner

/** Narrow a plan to the rows that haven't changed since it was made. */
export function boundPlan(plan: OwnershipPlan, current: ReadonlyArray<OwnedRow | undefined | null>): OwnershipPlan {
  const byId = new Map<string, OwnedRow>()
  for (const row of current) if (row) byId.set(row.id, row)
  return {
    deletions: plan.deletions.filter((row) => rowStillMatches(byId.get(row.id), row)),
    claims: plan.claims.filter((row) => rowStillMatches(byId.get(row.id), row)),
  }
}

/**
 * Whether a local conversation may be shown. A signed-in user sees only rows
 * whose claim has committed to them, so import is offered only for chats that
 * are really theirs. Everyone else, including a pending or unknown session,
 * sees unowned guest rows only.
 */
export function isLocalRowVisible(row: { userId?: string; legacyOwner?: boolean }, viewer: LocalSessionState): boolean {
  if (viewer.status === 'signed-in') return row.userId === viewer.userId && !row.legacyOwner
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
    /** Must apply the plan with compare-and-set semantics (see boundPlan). */
    apply: (session: LocalSessionState, plan: OwnershipPlan) => Promise<void>
  },
): Promise<OwnershipSyncOutcome> {
  if (session.status !== 'signed-in' && session.status !== 'signed-out') return 'skipped'
  const plan = planOwnershipSync(await deps.readRows(), session)
  if (isEmptyPlan(plan)) return 'skipped'
  if (!sameSession(await deps.confirm(), session)) return 'unconfirmed'
  await deps.apply(session, plan)
  return 'applied'
}

/** Delay before retrying an unconfirmed or failed ownership sync (attempt starts at 0). */
export const ownershipRetryDelayMs = (attempt: number) => Math.min(30_000, 1_000 * 2 ** attempt)

// ---------------------------------------------------------------------------
// Queued sends. A send made before it is known where it may go waits, and is
// bound to the identity that was on screen when it was made.

export type SendDestination = { kind: 'convex'; userId: string } | { kind: 'guest' }
export type SendCancelReason = 'identity-changed' | 'closed'
export type SendDecision = SendDestination | { kind: 'cancelled'; reason: SendCancelReason }

export interface SendGateState {
  session: LocalSessionState
  /** Where writes may go right now, or null while undecided. */
  destination: SendDestination | null
}

/**
 * Decide a queued send that was made while `origin` was the session. Returns
 * null to keep waiting.
 * - Made by signed-in user X: goes only to X's Convex account, once Convex is
 *   verified to be X. Cancelled if X signs out or another account appears.
 * - Made while signed out (or while the session was unknown, which shows the
 *   guest view): stays local. Cancelled if someone signs in.
 * - Made while the first session check was still pending: the gate binds it
 *   to the first session that check reports (see latchOrigin), and from then on
 *   the rules above apply. Until then it never goes anywhere.
 */
export function decideQueuedSend(origin: LocalSessionState, state: SendGateState): SendDecision | null {
  const { session, destination } = state
  const cancelled = { kind: 'cancelled', reason: 'identity-changed' } as const
  switch (origin.status) {
    case 'signed-in':
      if (session.status === 'signed-out') return cancelled
      if (session.status === 'signed-in' && session.userId !== origin.userId) return cancelled
      if (
        session.status === 'signed-in' &&
        destination?.kind === 'convex' &&
        destination.userId === origin.userId
      ) {
        return destination
      }
      return null
    case 'signed-out':
    case 'unknown':
      if (session.status === 'signed-in') return cancelled
      return destination?.kind === 'guest' ? destination : null
    case 'pending':
      // Not bound to an identity yet; createSendGate latches one first.
      return null
  }
}

/**
 * The identity a queued send is bound to. A send made while the first session
 * check was pending is bound to the first non-pending session reported, even
 * if Convex isn't ready yet; later sessions don't rebind it.
 */
export const latchOrigin = (origin: LocalSessionState, session: LocalSessionState): LocalSessionState =>
  origin.status === 'pending' && session.status !== 'pending' ? session : origin

export interface SendGate {
  update(state: SendGateState): void
  /** Queue a send made now. Resolves with where it may go, or why it was cancelled. */
  request(): { queued: boolean; decision: Promise<SendDecision> }
  /** Cancel everything still waiting and refuse new requests (the view went away). */
  close(): void
  /** Accept requests again (the view mounted, or remounted under React StrictMode). */
  open(): void
}

export function createSendGate(initial: SendGateState): SendGate {
  let state = initial
  let closed = false
  const waiters = new Set<{ origin: LocalSessionState; resolve: (d: SendDecision) => void }>()

  const settle = () => {
    for (const waiter of [...waiters]) {
      waiter.origin = latchOrigin(waiter.origin, state.session)
      const decision = decideQueuedSend(waiter.origin, state)
      if (decision) {
        waiters.delete(waiter)
        waiter.resolve(decision)
      }
    }
  }

  return {
    update(next) {
      state = next
      settle()
    },
    request() {
      if (closed) return { queued: false, decision: Promise.resolve({ kind: 'cancelled', reason: 'closed' }) }
      const origin: LocalSessionState = state.session
      const now = decideQueuedSend(origin, state)
      if (now) return { queued: false, decision: Promise.resolve(now) }
      return {
        queued: true,
        decision: new Promise<SendDecision>((resolve) => waiters.add({ origin, resolve })),
      }
    },
    close() {
      closed = true
      for (const waiter of waiters) waiter.resolve({ kind: 'cancelled', reason: 'closed' })
      waiters.clear()
    },
    open() {
      closed = false
    },
  }
}
