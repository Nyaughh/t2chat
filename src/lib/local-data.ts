import { db, type DBMessage } from './dexie'
import { decideLocalDataOwner, type LocalSessionState } from './local-data-policy'
import type { GuestMessageStore } from './guest-stream'

// localStorage key holding the id of the signed-in user who owns the guest
// chats currently in IndexedDB (see local-data-policy.ts).
const OWNER_KEY = 't2chat:local-data-owner'

const readOwner = (): string | null => {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

const writeOwner = (owner: string | null) => {
  try {
    if (owner === null) localStorage.removeItem(OWNER_KEY)
    else localStorage.setItem(OWNER_KEY, owner)
  } catch {
    // Storage can be unavailable (private mode, quota). Nothing else to do.
  }
}

/** Delete every local chat and message in one transaction. */
export async function clearLocalChatData(): Promise<void> {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.conversations.clear()
    await db.messages.clear()
  })
}

// Serialize owner checks: several hook instances run them at once.
let queue: Promise<unknown> = Promise.resolve()

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

/**
 * Apply the ownership rules for the current session. Clears local chats when the
 * previous owner's session has ended or another account signed in. Resolves to
 * whether local chats may be shown. Rejects if clearing failed, in which case
 * the caller must keep local chats hidden.
 */
export function syncLocalDataOwner(session: LocalSessionState): Promise<boolean> {
  return enqueue(async () => {
    const decision = decideLocalDataOwner(readOwner(), session)
    if (decision.clear) await clearLocalChatData()
    if (decision.nextOwner !== undefined) writeOwner(decision.nextOwner)
    return decision.visible
  })
}

/** Wipe local chats and forget the owner. Used right before an explicit sign-out. */
export function releaseLocalData(): Promise<void> {
  return enqueue(async () => {
    await clearLocalChatData()
    writeOwner(null)
  })
}

export const dexieGuestMessageStore: GuestMessageStore = {
  add: (message: DBMessage) => db.messages.add(message),
  update: (id, changes) => db.messages.update(id, changes),
  delete: (id) => db.messages.delete(id),
}
