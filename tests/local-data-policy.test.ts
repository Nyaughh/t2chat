// S7: chats must not leak across sign-out or a user switch on a shared browser,
// no local-only chat of the current user may be lost, and queued sends must
// only run as the identity that made them.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGACY_GUEST_OWNER,
  RECOVERED_CHAT_TITLE,
  boundPlan,
  chatsBelongTo,
  createSendGate,
  decideQueuedSend,
  isGuestLocalId,
  isGuestWritable,
  hasActiveReply,
  importableLocalChats,
  isLocalRowVisible,
  latchOrigin,
  ownershipRetryDelayMs,
  planLegacyCleanup,
  withLease,
  withoutLease,
  planOwnershipSync,
  runOwnershipSync,
  sessionStateFrom,
  type LegacyConversation,
  type LegacyMessage,
  type LocalSessionState,
  type OwnedRow,
  type OwnershipPlan,
  type SendDecision,
} from '../src/lib/local-data-policy'

const G1 = '3b241101-e2bb-4255-8caf-4136c566a962'
const G2 = '9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f'
const G3 = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d'
const M1 = '11111111-2222-4333-8444-555555555555'
const M2 = '66666666-7777-4888-9999-aaaaaaaaaaaa'
const CONVEX_CHAT = 'k57a2m9x3h1q8d4c6e0rjtw5vs7b2n3f'
const CONVEX_MSG = 'j97b3n2m8x4q1d5c7e0rktw6vs8b3n4g'

const A: LocalSessionState = { status: 'signed-in', userId: 'userA' }
const B: LocalSessionState = { status: 'signed-in', userId: 'userB' }
const OUT: LocalSessionState = { status: 'signed-out' }
const PENDING: LocalSessionState = { status: 'pending' }
const UNKNOWN: LocalSessionState = { status: 'unknown' }

const ids = (rows: ReadonlyArray<OwnedRow>) => rows.map((r) => r.id)

/**
 * In-memory stand-in for the conversations table. `apply` behaves like
 * local-data.ts: compare-and-set against the rows as they are when it runs.
 */
function memoryRows(rows: OwnedRow[]) {
  let current = rows.map((r) => ({ ...r }))
  return {
    get: () => current,
    visibleTo: (viewer: LocalSessionState) => ids(current.filter((r) => isLocalRowVisible(r, viewer))),
    readRows: async () => current.map((r) => ({ ...r })),
    add: (row: OwnedRow) => current.push({ ...row }),
    apply: async (session: LocalSessionState, plan: OwnershipPlan, now = 0) => {
      const bound = boundPlan(plan, current)
      const leased = new Set(ids(current.filter((r) => hasActiveReply(r, now))))
      const del = new Set(ids(bound.deletions).filter((id) => !leased.has(id)))
      const claim = new Set(ids(bound.claims))
      current = current
        .filter((r) => !del.has(r.id))
        .map((r) =>
          claim.has(r.id) && session.status === 'signed-in' ? { ...r, userId: session.userId, legacyOwner: undefined } : r,
        )
        .map((r) => (r.legacyOwner === undefined ? (({ legacyOwner: _l, ...rest }) => rest)(r) : r))
      return bound.deletions.length - del.size
    },
  }
}

/** A promise you resolve by hand, to hold a server response back. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

test('guest ids are UUIDs, Convex ids are not', () => {
  assert.equal(isGuestLocalId(G1), true)
  assert.equal(isGuestLocalId(CONVEX_CHAT), false)
  assert.equal(isGuestLocalId(undefined), false)
})

test('session state: only an explicit null payload is signed out', () => {
  assert.deepEqual(sessionStateFrom({ data: { user: { id: 'userA' } } }), A)
  // A failed refetch keeps the known user.
  assert.deepEqual(sessionStateFrom({ data: { user: { id: 'userA' } }, error: new Error('offline') }), A)
  assert.deepEqual(sessionStateFrom({ isPending: true }), PENDING)
  assert.deepEqual(sessionStateFrom({ data: null, error: new Error('offline') }), UNKNOWN)
  assert.deepEqual(sessionStateFrom({ data: null }), OUT)
  // A payload without a user id, or no payload at all, is not a confirmed sign-out.
  assert.deepEqual(sessionStateFrom({ data: {} as { user?: null } }), UNKNOWN)
  assert.deepEqual(sessionStateFrom({ data: { user: null } }), UNKNOWN)
  assert.deepEqual(sessionStateFrom({}), UNKNOWN)
})

test('S7 before/after: A signs in, signs out; the next visitor sees none of A’s local chats', async () => {
  const rows = memoryRows([{ id: G1 }, { id: G2, userId: 'userA', legacyOwner: true }])
  // Import is offered only once the claim has committed.
  assert.deepEqual(rows.visibleTo(A), [])
  assert.equal(await runOwnershipSync(A, { ...rows, confirm: async () => A }), 'applied')
  assert.deepEqual(rows.get(), [
    { id: G1, userId: 'userA' },
    { id: G2, userId: 'userA' },
  ])
  assert.deepEqual(rows.visibleTo(A), [G1, G2], 'A can import both')
  assert.deepEqual(rows.visibleTo(B), [], 'B cannot')

  // A signs out. Until the wipe lands, the signed-out view already hides them.
  assert.deepEqual(rows.visibleTo(OUT), [])
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => OUT }), 'applied')
  assert.deepEqual(rows.get(), [])
})

test('an unclaimed row is never offered for import and survives A’s sign-out as guest data', async () => {
  const rows = memoryRows([{ id: G1 }])
  // The claim's server confirmation fails: nothing changes, nothing is offered.
  assert.equal(await runOwnershipSync(A, { ...rows, confirm: async () => UNKNOWN }), 'unconfirmed')
  assert.deepEqual(rows.visibleTo(A), [])
  assert.deepEqual(rows.visibleTo(B), [])
  // A later retry for the same session succeeds.
  assert.equal(await runOwnershipSync(A, { ...rows, confirm: async () => A }), 'applied')
  assert.deepEqual(rows.visibleTo(A), [G1])
})

test('a failed sign-out (session still A) keeps A’s unimported chats', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }])
  assert.equal(await runOwnershipSync(A, { ...rows, confirm: async () => A }), 'skipped')
  assert.deepEqual(rows.visibleTo(A), [G1])
})

test('race: a delayed signed-out confirmation cannot delete what another tab claimed for B meanwhile', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }, { id: G3 }])
  const outConfirm = deferred<LocalSessionState>()

  // Tab 1 sees A's session end and waits for the server.
  const tab1 = runOwnershipSync(OUT, { ...rows, confirm: () => outConfirm.promise })
  await new Promise((r) => setTimeout(r, 0))

  // Meanwhile tab 2: B signs in, deletes A's row and claims the unowned one.
  assert.equal(await runOwnershipSync(B, { ...rows, confirm: async () => B }), 'applied')
  assert.deepEqual(rows.get(), [{ id: G3, userId: 'userB' }])

  // The late OUT confirmation arrives (B's cookie was set afterwards).
  outConfirm.resolve(OUT)
  assert.equal(await tab1, 'applied')
  assert.deepEqual(rows.get(), [{ id: G3, userId: 'userB' }], 'B’s only copy survives')
})

test('race: a stale signed-out view never deletes rows another tab just claimed', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }])
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => A }), 'unconfirmed')
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => UNKNOWN }), 'unconfirmed')
  assert.deepEqual(rows.get(), [{ id: G1, userId: 'userA' }])
})

test('the sign-out wipe deletes only the rows it snapshotted before the request', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }, { id: G3 }])
  const snapshot = planOwnershipSync(rows.get(), OUT)
  // While the sign-out request (and the caller's onSuccess) runs, B signs in
  // elsewhere and claims the unowned row; a new guest row also appears.
  await rows.apply(B, planOwnershipSync(rows.get(), B))
  rows.add({ id: G2 })
  await rows.apply(OUT, snapshot)
  assert.deepEqual(rows.get(), [{ id: G3, userId: 'userB' }, { id: G2 }])
})

test('compare-and-set: rows changed since planning are skipped', () => {
  const plan = planOwnershipSync([{ id: G1, userId: 'userA' }, { id: G2 }], B)
  assert.deepEqual(ids(plan.deletions), [G1])
  assert.deepEqual(ids(plan.claims), [G2])
  const bound = boundPlan(plan, [{ id: G1, userId: 'userB' }, undefined])
  assert.deepEqual(bound, { deletions: [], claims: [] })
})

test('pending or unknown sessions never change ownership', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }, { id: G2 }])
  const confirm = async (): Promise<LocalSessionState> => {
    throw new Error('should not be asked')
  }
  assert.equal(await runOwnershipSync(PENDING, { ...rows, confirm }), 'skipped')
  assert.equal(await runOwnershipSync(UNKNOWN, { ...rows, confirm }), 'skipped')
  assert.equal(rows.get().length, 2)
})

test('a wipe waits for a reply lease: deferred while a guest reply is still being written, done after release', async () => {
  const lease = withLease(undefined, 'reply-1', 30_000, 0)
  const rows = memoryRows([{ id: G1, userId: 'userA', inFlight: lease }])
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => OUT }), 'deferred')
  assert.equal(rows.get().length, 1, 'not deleted while its reply text may be only in memory')
  rows.get()[0].inFlight = withoutLease(rows.get()[0].inFlight, 'reply-1', 0)
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => OUT }), 'applied')
  assert.deepEqual(rows.get(), [])
})

test('reply leases: active until released or expired; a leased chat is not importable', () => {
  const leases = withLease(withLease(undefined, 'r1', 100, 0), 'r2', 200, 0)
  assert.equal(hasActiveReply({ inFlight: leases }, 50), true)
  assert.equal(hasActiveReply({ inFlight: leases }, 250), false, 'a dead tab’s lease expires')
  assert.deepEqual(withoutLease(leases, 'r1', 0), { r2: 200 })
  assert.equal(withoutLease({ r1: 100 }, 'r1', 0), undefined)
  const rows = [{ id: G1, userId: 'userA', inFlight: { r1: 100 } }, { id: G2, userId: 'userA' }]
  assert.deepEqual(ids(importableLocalChats(rows, A, new Set(), 50)), [G2])
  assert.deepEqual(ids(importableLocalChats(rows, A, new Set(), 150)), [G1, G2])
  assert.deepEqual(ids(importableLocalChats(rows, A, new Set([G2]), 150)), [G1], 'already on the server')
})

test('retries back off and are capped', () => {
  assert.deepEqual([0, 1, 2, 3, 10].map(ownershipRetryDelayMs), [1000, 2000, 4000, 8000, 30000])
})

test('user switch: B signing in deletes A’s claimed and legacy rows, claims unowned ones', () => {
  const plan = planOwnershipSync(
    [{ id: G1, userId: 'userA' }, { id: G2, userId: 'userA', legacyOwner: true }, { id: G3 }],
    B,
  )
  assert.deepEqual(ids(plan.deletions), [G1, G2])
  assert.deepEqual(ids(plan.claims), [G3])
})

test('legacy rows survive a signed-out first open, hidden, and stay with their owner', () => {
  const rows: OwnedRow[] = [{ id: G1, userId: 'userA', legacyOwner: true }, { id: G2 }]
  assert.deepEqual(planOwnershipSync(rows, OUT), { deletions: [], claims: [] })
  assert.deepEqual(ids(rows.filter((r) => isLocalRowVisible(r, OUT))), [G2], 'legacy-owned rows are not guest data')
  assert.deepEqual(ids(rows.filter((r) => isLocalRowVisible(r, B))), [], 'another account can’t see them')
  assert.deepEqual(ids(rows.filter((r) => isLocalRowVisible(r, A))), [], 'not offered before the claim commits')
  assert.deepEqual(ids(planOwnershipSync(rows, A).claims), [G1, G2], 'their owner keeps them')
})

test('guest writes are allowed only into an existing unowned chat', () => {
  assert.equal(isGuestWritable({}), true)
  assert.equal(isGuestWritable({ userId: 'userA' }), false)
  assert.equal(isGuestWritable(undefined), false)
})

test('server chat lists are bound to the verified user id', () => {
  const chats = [{ userId: 'userA' }, { userId: 'userA' }]
  assert.equal(chatsBelongTo(chats, 'userA'), true)
  assert.equal(chatsBelongTo(chats, 'userB'), false)
  assert.equal(chatsBelongTo([{ userId: 'userA' }, { userId: 'userB' }], 'userA'), false)
})

test('v4 upgrade: drops server copies, recovers local messages sent into a copied chat', () => {
  const created = (s: number) => new Date(2026, 0, 1, 0, 0, s)
  const conversations: LegacyConversation[] = [
    { id: CONVEX_CHAT, title: 'A’s private server title' },
    { id: G1, title: 'plain guest chat' },
    { id: G2, userId: LEGACY_GUEST_OWNER, title: 'acd4812 guest chat' },
    { id: G3, userId: 'userA', title: 'acd4812 signed-in local chat' },
  ]
  const messages: LegacyMessage[] = [
    { id: CONVEX_MSG, conversationId: CONVEX_CHAT, createdAt: created(1), content: 'server message' },
    { id: M1, conversationId: CONVEX_CHAT, createdAt: created(5), content: 'typed after sign-out' },
    { id: M2, conversationId: CONVEX_CHAT, createdAt: created(3), content: 'reply' },
    { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', conversationId: G1, createdAt: created(2) },
  ]
  let n = 0
  const plan = planLegacyCleanup(conversations, messages, () => `00000000-0000-4000-8000-00000000000${++n}`)

  assert.deepEqual(plan.deleteConversationIds, [CONVEX_CHAT])
  assert.deepEqual(plan.deleteMessageIds, [CONVEX_MSG])

  const recovered = plan.putConversations.find((c) => c.title === RECOVERED_CHAT_TITLE)!
  assert.ok(recovered && isGuestLocalId(recovered.id))
  assert.equal(recovered.userId, undefined, 'recovered chat is an unowned guest chat')
  assert.deepEqual(recovered.createdAt, created(3))
  assert.deepEqual(recovered.lastMessageAt, created(5))
  assert.deepEqual(plan.moveMessages, [
    { id: M1, conversationId: recovered.id },
    { id: M2, conversationId: recovered.id },
  ])

  const g2 = plan.putConversations.find((c) => c.id === G2)!
  assert.equal('userId' in g2, false, "'local-user' becomes unowned")
  const g3 = plan.putConversations.find((c) => c.id === G3)!
  assert.deepEqual([g3.userId, g3.legacyOwner], ['userA', true], 'real owner becomes a hidden legacy owner')
  assert.equal(
    plan.putConversations.some((c) => c.id === G1),
    false,
    'ordinary guest chats are left untouched',
  )
})

// --- Queued sends ----------------------------------------------------------

const CONVEX_A = { kind: 'convex', userId: 'userA' } as const
const CONVEX_B = { kind: 'convex', userId: 'userB' } as const
const GUEST = { kind: 'guest' } as const
const CANCELLED = { kind: 'cancelled', reason: 'identity-changed' } as const

const settled = async (p: Promise<SendDecision>) => {
  let value: SendDecision | 'waiting' = 'waiting'
  p.then((v) => (value = v))
  await new Promise((r) => setTimeout(r, 0))
  return value
}

test('a send made by A while waiting for the Convex token goes to A once Convex is verified as A', async () => {
  const gate = createSendGate({ session: A, destination: null })
  const { queued, decision } = gate.request()
  assert.equal(queued, true)
  // A token for another user (stale) is not enough.
  gate.update({ session: A, destination: null })
  assert.equal(await settled(decision), 'waiting')
  gate.update({ session: A, destination: CONVEX_A })
  assert.deepEqual(await decision, CONVEX_A)
})

test('A’s queued send is cancelled if A signs out or B signs in before it can go', async () => {
  const g1 = createSendGate({ session: A, destination: null })
  const r1 = g1.request()
  g1.update({ session: OUT, destination: GUEST })
  assert.deepEqual(await r1.decision, CANCELLED, 'not written into the new guest session')

  const g2 = createSendGate({ session: A, destination: null })
  const r2 = g2.request()
  g2.update({ session: B, destination: CONVEX_B })
  assert.deepEqual(await r2.decision, CANCELLED, 'not sent to B’s account')
})

test('decideQueuedSend never routes A’s send to a Convex destination of another user', () => {
  assert.equal(decideQueuedSend(A, { session: A, destination: CONVEX_B }), null)
  assert.equal(decideQueuedSend(A, { session: A, destination: GUEST }), null)
})

test('a guest’s queued send stays local and is cancelled if someone signs in', async () => {
  const gate = createSendGate({ session: UNKNOWN, destination: null })
  const r = gate.request()
  gate.update({ session: A, destination: CONVEX_A })
  assert.deepEqual(await r.decision, CANCELLED)

  const g2 = createSendGate({ session: UNKNOWN, destination: null })
  const r2 = g2.request()
  g2.update({ session: OUT, destination: GUEST })
  assert.deepEqual(await r2.decision, GUEST)
})

test('a send made during the first session check binds to the identity it reports', async () => {
  const gate = createSendGate({ session: PENDING, destination: null })
  const r = gate.request()
  gate.update({ session: A, destination: null }) // signed in, token not ready
  assert.equal(await settled(r.decision), 'waiting')
  gate.update({ session: A, destination: CONVEX_A })
  assert.deepEqual(await r.decision, CONVEX_A)
})

test('a send made while pending is bound to the first identity reported, even before its token is ready', async () => {
  // pending -> A (no token yet) -> B with a ready token: must not go to B.
  const g1 = createSendGate({ session: PENDING, destination: null })
  const r1 = g1.request()
  g1.update({ session: A, destination: null })
  g1.update({ session: B, destination: CONVEX_B })
  assert.deepEqual(await r1.decision, CANCELLED)

  // pending -> A (no token yet) -> signed out: must not be written as guest data.
  const g2 = createSendGate({ session: PENDING, destination: null })
  const r2 = g2.request()
  g2.update({ session: A, destination: null })
  g2.update({ session: OUT, destination: GUEST })
  assert.deepEqual(await r2.decision, CANCELLED)

  // pending -> signed out: stays local.
  const g3 = createSendGate({ session: PENDING, destination: null })
  const r3 = g3.request()
  g3.update({ session: OUT, destination: GUEST })
  assert.deepEqual(await r3.decision, GUEST)

  // pending never goes anywhere on its own.
  assert.equal(decideQueuedSend(PENDING, { session: PENDING, destination: GUEST }), null)
  assert.deepEqual(latchOrigin(PENDING, A), A)
  assert.deepEqual(latchOrigin(A, B), A)
})

test('closing the view settles waiting sends as cancelled; reopening accepts new ones', async () => {
  const gate = createSendGate({ session: A, destination: null })
  const r = gate.request()
  gate.close()
  assert.deepEqual(await r.decision, { kind: 'cancelled', reason: 'closed' })
  assert.deepEqual(await gate.request().decision, { kind: 'cancelled', reason: 'closed' })
  gate.open()
  gate.update({ session: A, destination: CONVEX_A })
  const again = gate.request()
  assert.equal(again.queued, false)
  assert.deepEqual(await again.decision, CONVEX_A)
})
