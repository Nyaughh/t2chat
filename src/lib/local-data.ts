import { db, type Conversation, type DBMessage } from './dexie'
import {
  REPLY_LEASE_MS,
  boundPlan,
  hasActiveReply,
  isGuestWritable,
  localSessionKey,
  planOwnershipSync,
  runOwnershipSync,
  type LocalSessionState,
  type OwnershipPlan,
  type OwnershipSyncOutcome,
  withLease,
  withoutLease,
} from './local-data-policy'
import { createGuestReplyRegistry, type GuestMessageStore } from './guest-stream'

// All reads and writes of local (guest) chats go through here. Ownership lives
// in the conversation rows themselves (see local-data-policy.ts) and only
// changes inside Dexie transactions, so it can't drift from the data, and
// several tabs see one consistent state.

/** Thrown when a guest write targets a chat that is gone or owned by a signed-in user. */
export class GuestChatUnavailableError extends Error {
  constructor() {
    super('This chat is no longer available.')
    this.name = 'GuestChatUnavailableError'
  }
}

const rw = <T>(fn: () => Promise<T>) => db.transaction('rw', db.conversations, db.messages, fn)

async function writableConversation(conversationId: string) {
  const conv = await db.conversations.get(conversationId)
  return isGuestWritable(conv) ? conv : null
}

/** Create a new unowned guest chat. */
export async function createGuestConversation(conv: Omit<Conversation, 'userId' | 'legacyOwner'>): Promise<void> {
  await db.conversations.add({ ...conv })
}

/** Add a message to a guest chat and bump its activity time. Throws if the chat isn't writable. */
export async function addGuestMessage(message: DBMessage): Promise<void> {
  await rw(async () => {
    if (!(await writableConversation(message.conversationId))) throw new GuestChatUnavailableError()
    await db.messages.add(message)
    await db.conversations.update(message.conversationId, {
      updatedAt: message.createdAt,
      lastMessageAt: message.createdAt,
    })
  })
}

/** Edit a guest message's text. Throws if its chat isn't writable. */
export async function updateGuestMessageContent(conversationId: string, messageId: string, content: string) {
  await rw(async () => {
    const msg = await db.messages.get(messageId)
    if (!msg || msg.conversationId !== conversationId || !(await writableConversation(conversationId))) {
      throw new GuestChatUnavailableError()
    }
    await db.messages.update(messageId, { content })
  })
}

/** Delete messages from a guest chat. Throws if the chat isn't writable. */
export async function deleteGuestMessages(conversationId: string, messageIds: string[]) {
  await rw(async () => {
    if (!(await writableConversation(conversationId))) throw new GuestChatUnavailableError()
    const rows = await db.messages.bulkGet(messageIds)
    await db.messages.bulkDelete(rows.filter((m) => m?.conversationId === conversationId).map((m) => m!.id))
  })
}

/** Messages of a guest chat, oldest first, or null if the chat isn't writable. */
export async function readGuestHistory(conversationId: string): Promise<DBMessage[] | null> {
  return db.transaction('r', db.conversations, db.messages, async () => {
    if (!(await writableConversation(conversationId))) return null
    return db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
  })
}

/** Delete a guest chat and its messages. */
export async function deleteGuestConversation(conversationId: string) {
  await rw(async () => {
    if (!(await writableConversation(conversationId))) throw new GuestChatUnavailableError()
    await db.conversations.delete(conversationId)
    await db.messages.where('conversationId').equals(conversationId).delete()
  })
}

/**
 * Store used by guest replies. Every write re-checks the chat: a deleted
 * (wiped) message or chat is never recreated, and a chat claimed by a user who
 * signed in mid-reply gets only the one final `saveClaimed` write.
 */
const renewLeaseIn = async (conversationId: string, messageId: string) => {
  const now = Date.now()
  await db.conversations
    .where('id')
    .equals(conversationId)
    .modify((conv) => {
      conv.inFlight = withLease(conv.inFlight, messageId, now + REPLY_LEASE_MS, now)
    })
}

export const guardedGuestMessageStore: GuestMessageStore = {
  // The placeholder and its reply lease are written in one transaction, so
  // the chat is never importable with an unfinished reply.
  add: (message) =>
    rw(async () => {
      if (!(await writableConversation(message.conversationId))) return false
      await db.messages.add(message)
      await renewLeaseIn(message.conversationId, message.id)
      return true
    }),
  update: (id, changes) =>
    rw(async () => {
      const msg = await db.messages.get(id)
      const conv = msg ? await db.conversations.get(msg.conversationId) : undefined
      if (!msg || !conv) return 'gone'
      if (!isGuestWritable(conv)) return 'claimed'
      await db.messages.update(id, changes)
      await renewLeaseIn(msg.conversationId, id)
      return 'ok'
    }),
  renewLease: (conversationId, messageId) =>
    rw(async () => {
      const conv = await db.conversations.get(conversationId)
      if (conv?.inFlight?.[messageId] !== undefined) await renewLeaseIn(conversationId, messageId)
    }),
  releaseLease: (conversationId, messageId) =>
    rw(async () => {
      const now = Date.now()
      await db.conversations
        .where('id')
        .equals(conversationId)
        .modify((conv) => {
          const next = withoutLease(conv.inFlight, messageId, now)
          if (next) conv.inFlight = next
          else delete conv.inFlight
        })
    }),
  saveClaimed: (id, changes) =>
    rw(async () => {
      const msg = await db.messages.get(id)
      if (!msg || !(await db.conversations.get(msg.conversationId))) return false
      await db.messages.update(id, changes)
      return true
    }),
  delete: (id) => db.messages.delete(id),
}

/** The running guest reply, shared by every mounted chat view. */
export const guestReplies = createGuestReplyRegistry({ store: guardedGuestMessageStore })

/**
 * Apply a plan with compare-and-set semantics: only rows that still have the
 * exact ownership state recorded in the plan are deleted or claimed. A plan
 * made for an older session therefore can't undo a newer transition (another
 * tab signing in, deleting the old owner's rows and claiming the rest).
 */
async function applyPlan(session: LocalSessionState, plan: OwnershipPlan): Promise<number> {
  return rw(async () => {
    const ids = [...plan.deletions, ...plan.claims].map((row) => row.id)
    const current = await db.conversations.bulkGet(ids)
    const bound = boundPlan(plan, current)
    // A chat whose guest reply is still being written (in any tab) is deleted
    // only after that reply's final text is stored; the caller retries.
    const now = Date.now()
    const leased = new Set(current.filter((c) => c && hasActiveReply(c, now)).map((c) => c!.id))
    const deleteIds = bound.deletions.map((row) => row.id).filter((id) => !leased.has(id))
    const deferred = bound.deletions.length - deleteIds.length
    if (deleteIds.length > 0) {
      await db.messages.where('conversationId').anyOf(deleteIds).delete()
      await db.conversations.bulkDelete(deleteIds)
    }
    if (session.status === 'signed-in' && bound.claims.length > 0) {
      await db.conversations
        .where('id')
        .anyOf(bound.claims.map((row) => row.id))
        .modify((conv) => {
          conv.userId = session.userId
          delete conv.legacyOwner
        })
    }
    return deferred
  })
}

// Serialize syncs from several hook instances.
let queue: Promise<unknown> = Promise.resolve()

/**
 * Bring the local rows in line with `session`: claim unowned rows for a
 * signed-in user, delete rows of an account whose session ended or that is not
 * the signed-in one. Before changing anything it asks the server for the
 * session again (`confirm`), so a stale in-memory session (for example another
 * tab just signed in) never deletes or claims rows. Does nothing for a pending
 * or unknown session.
 */
export function syncLocalOwnership(
  session: LocalSessionState,
  confirm: () => Promise<LocalSessionState>,
): Promise<OwnershipSyncOutcome> {
  // Several mounted hooks ask for the same sync at once; run it once.
  const key = localSessionKey(session)
  const existing = queuedSyncs.get(key)
  if (existing) return existing
  const run = () => {
    queuedSyncs.delete(key)
    return runOwnershipSync(session, { readRows: () => db.conversations.toArray(), confirm, apply: applyPlan })
  }
  const result = queue.then(run, run)
  queuedSyncs.set(key, result)
  queue = result.catch(() => undefined)
  return result
}

const queuedSyncs = new Map<string, Promise<OwnershipSyncOutcome>>()

/**
 * Record which claimed rows exist right before an explicit sign-out. Pass the
 * result to `wipeClaimedLocalData` once the sign-out has succeeded.
 */
export async function snapshotClaimedLocalData(): Promise<OwnershipPlan> {
  return planOwnershipSync(await db.conversations.toArray(), { status: 'signed-out' })
}

/**
 * Delete the rows recorded by `snapshotClaimedLocalData`, if they are still in
 * that state. Rows claimed or changed after the snapshot are left alone.
 */
export function wipeClaimedLocalData(snapshot: OwnershipPlan): Promise<void> {
  // Rows deferred here (a reply still being written) are wiped by the session
  // guard once their lease ends.
  const run = () => applyPlan({ status: 'signed-out' }, snapshot).then(() => undefined)
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}

// While an explicit sign-out request is in flight, the signed-in user's local
// chats are hidden. They are deleted if it succeeds and shown again if it fails.
let signingOut = 0
const signingOutListeners = new Set<() => void>()
export const signingOutStore = {
  subscribe(listener: () => void) {
    signingOutListeners.add(listener)
    return () => {
      signingOutListeners.delete(listener)
    }
  },
  getSnapshot: () => signingOut > 0,
  begin() {
    signingOut++
    signingOutListeners.forEach((l) => l())
  },
  end() {
    signingOut = Math.max(0, signingOut - 1)
    signingOutListeners.forEach((l) => l())
  },
}
