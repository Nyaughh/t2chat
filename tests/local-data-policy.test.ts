// S7: chats must not leak across sign-out or a user switch on a shared browser,
// and no local-only chat of the current user may be lost.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGACY_GUEST_OWNER,
  RECOVERED_CHAT_TITLE,
  chatsBelongTo,
  createModeGate,
  isGuestLocalId,
  isGuestWritable,
  isLocalRowVisible,
  planLegacyCleanup,
  planOwnershipSync,
  runOwnershipSync,
  sessionStateFrom,
  type LegacyConversation,
  type LegacyMessage,
  type LocalSessionState,
  type OwnedRow,
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

/** Tiny in-memory stand-in for the conversations table, applying plans like local-data.ts does. */
function memoryRows(rows: OwnedRow[]) {
  let current = rows.map((r) => ({ ...r }))
  return {
    get: () => current,
    visibleTo: (viewer: LocalSessionState) => current.filter((r) => isLocalRowVisible(r, viewer)).map((r) => r.id),
    readRows: async () => current,
    apply: async (session: LocalSessionState) => {
      const plan = planOwnershipSync(current, session)
      current = current
        .filter((r) => !plan.deleteConversationIds.includes(r.id))
        .map((r) =>
          plan.claimConversationIds.includes(r.id) && session.status === 'signed-in'
            ? { id: r.id, userId: session.userId }
            : r,
        )
    },
  }
}

test('guest ids are UUIDs, Convex ids are not', () => {
  assert.equal(isGuestLocalId(G1), true)
  assert.equal(isGuestLocalId(CONVEX_CHAT), false)
  assert.equal(isGuestLocalId(undefined), false)
})

test('session state comes from the Better Auth result', () => {
  assert.deepEqual(sessionStateFrom({ data: { user: { id: 'userA' } } }), A)
  // A failed refetch keeps the known user.
  assert.deepEqual(sessionStateFrom({ data: { user: { id: 'userA' } }, error: new Error('offline') }), A)
  assert.deepEqual(sessionStateFrom({ isPending: true }), PENDING)
  assert.deepEqual(sessionStateFrom({ data: null, error: new Error('offline') }), UNKNOWN)
  assert.deepEqual(sessionStateFrom({ data: null }), OUT)
})

test('S7 before/after: A signs in, signs out; the next visitor sees none of A’s local chats', async () => {
  // A guest chat exists, A signs in and sees it (claimed), A also has a legacy row.
  const rows = memoryRows([{ id: G1 }, { id: G2, userId: 'userA', legacyOwner: true }])
  const confirm = async () => A
  assert.equal(await runOwnershipSync(A, { ...rows, confirm }), 'applied')
  assert.deepEqual(
    rows.get().map((r) => [r.id, r.userId, !!r.legacyOwner]),
    [
      [G1, 'userA', false],
      [G2, 'userA', false],
    ],
  )
  assert.deepEqual(rows.visibleTo(A), [G1, G2], 'A can import both')

  // A signs out. Until the wipe lands, the signed-out view already hides them.
  assert.deepEqual(rows.visibleTo(OUT), [])
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => OUT }), 'applied')
  assert.deepEqual(rows.get(), [])
})

test('a failed sign-out (session still A) keeps A’s unimported chats', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }])
  // The guard only sees A; nothing to change.
  assert.equal(await runOwnershipSync(A, { ...rows, confirm: async () => A }), 'skipped')
  assert.deepEqual(rows.visibleTo(A), [G1])
})

test('a stale signed-out view never deletes rows another tab just claimed', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }])
  // This tab still thinks no one is signed in; the server says A is.
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => A }), 'unconfirmed')
  assert.deepEqual(rows.get(), [{ id: G1, userId: 'userA' }])
  // Same for an unreachable server.
  assert.equal(await runOwnershipSync(OUT, { ...rows, confirm: async () => UNKNOWN }), 'unconfirmed')
  assert.equal(rows.get().length, 1)
})

test('pending or unknown sessions never change ownership', async () => {
  const rows = memoryRows([{ id: G1, userId: 'userA' }, { id: G2 }])
  const confirm = async () => {
    throw new Error('should not be asked')
  }
  assert.equal(await runOwnershipSync(PENDING, { ...rows, confirm }), 'skipped')
  assert.equal(await runOwnershipSync(UNKNOWN, { ...rows, confirm }), 'skipped')
  assert.equal(rows.get().length, 2)
})

test('user switch: B signing in deletes A’s claimed and legacy rows, claims unowned ones', () => {
  const plan = planOwnershipSync(
    [{ id: G1, userId: 'userA' }, { id: G2, userId: 'userA', legacyOwner: true }, { id: G3 }],
    B,
  )
  assert.deepEqual(plan, { deleteConversationIds: [G1, G2], claimConversationIds: [G3] })
})

test('legacy rows survive a signed-out first open, hidden, and stay with their owner', () => {
  const rows: OwnedRow[] = [{ id: G1, userId: 'userA', legacyOwner: true }, { id: G2 }]
  assert.deepEqual(planOwnershipSync(rows, OUT), { deleteConversationIds: [], claimConversationIds: [] })
  assert.deepEqual(
    rows.filter((r) => isLocalRowVisible(r, OUT)).map((r) => r.id),
    [G2],
    'legacy-owned rows are not guest data',
  )
  assert.deepEqual(
    rows.filter((r) => isLocalRowVisible(r, B)).map((r) => r.id),
    [G2],
    'another account can’t see them',
  )
  assert.deepEqual(planOwnershipSync(rows, A).claimConversationIds, [G1, G2], 'their owner keeps them')
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
  assert.notEqual(recovered.title, 'A’s private server title')
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

test('a send made while the session is being checked waits instead of being dropped', async () => {
  const gate = createModeGate<'convex' | 'guest'>()
  let sentTo: string | null = null
  const pending = gate.wait().then((mode) => (sentTo = mode))
  gate.set(null) // still undecided (pending, unknown, or waiting for a Convex token)
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(sentTo, null)
  gate.set('guest') // confirmed signed out
  await pending
  assert.equal(sentTo, 'guest')
  assert.equal(await gate.wait(), 'guest')
})
