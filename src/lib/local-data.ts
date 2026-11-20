import { db, type Conversation, type DBMessage } from './dexie'
import {
  isGuestWritable,
  planOwnershipSync,
  runOwnershipSync,
  type LocalSessionState,
  type OwnershipSyncOutcome,
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

/** Store used by guest replies: every write re-checks that the chat is still an unowned guest chat. */
export const guardedGuestMessageStore: GuestMessageStore = {
  add: (message) =>
    rw(async () => {
      if (!(await writableConversation(message.conversationId))) return false
      await db.messages.add(message)
      return true
    }),
  update: (id, changes) =>
    rw(async () => {
      const msg = await db.messages.get(id)
      if (!msg || !(await writableConversation(msg.conversationId))) return false
      await db.messages.update(id, changes)
      return true
    }),
  delete: (id) => db.messages.delete(id),
}

/** The running guest reply, shared by every mounted chat view. */
export const guestReplies = createGuestReplyRegistry({ store: guardedGuestMessageStore })

async function applyPlan(session: LocalSessionState) {
  await rw(async () => {
    // Re-plan inside the transaction: other tabs may have changed the rows.
    const plan = planOwnershipSync(await db.conversations.toArray(), session)
    if (plan.deleteConversationIds.length > 0) {
      await db.messages.where('conversationId').anyOf(plan.deleteConversationIds).delete()
      await db.conversations.bulkDelete(plan.deleteConversationIds)
    }
    if (session.status === 'signed-in' && plan.claimConversationIds.length > 0) {
      await db.conversations
        .where('id')
        .anyOf(plan.claimConversationIds)
        .modify((conv) => {
          conv.userId = session.userId
          delete conv.legacyOwner
        })
    }
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
  const run = () => runOwnershipSync(session, { readRows: () => db.conversations.toArray(), confirm, apply: applyPlan })
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}

/** Wipe what signed-in users claimed. Call only after a sign-out has succeeded. */
export function wipeClaimedLocalData(): Promise<void> {
  const run = () => applyPlan({ status: 'signed-out' })
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
