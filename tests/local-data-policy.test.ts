// S7: chats must not leak across sign-out or a user switch on a shared browser.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideLocalDataOwner, isGuestLocalId, localSessionKey } from '../src/lib/local-data-policy'

const GUEST_ID = '3b241101-e2bb-4255-8caf-4136c566a962' // uuid v4, as created for guest chats
const CONVEX_CHAT_ID = 'k57a2m9x3h1q8d4c6e0rjtw5vs7b2n3f' // shape of a Convex document id

test('guest ids are UUIDs, Convex ids are not', () => {
  assert.equal(isGuestLocalId(GUEST_ID), true)
  assert.equal(isGuestLocalId(CONVEX_CHAT_ID), false)
  assert.equal(isGuestLocalId(undefined), false)
})

test('legacy v4 cleanup keeps guest rows and drops copied server rows', () => {
  // Before: older builds mirrored every signed-in chat into IndexedDB, and the
  // signed-out sidebar then listed them. The v4 upgrade runs this filter.
  const conversations = [{ id: GUEST_ID }, { id: CONVEX_CHAT_ID }]
  const messages = [
    { id: '9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f', conversationId: GUEST_ID },
    { id: 'j97b3n2m8x4q1d5c7e0rktw6vs8b3n4g', conversationId: CONVEX_CHAT_ID },
  ]
  assert.deepEqual(
    conversations.filter((c) => !isGuestLocalId(c.id)).map((c) => c.id),
    [CONVEX_CHAT_ID],
  )
  assert.deepEqual(
    messages.filter((m) => !isGuestLocalId(m.conversationId)).map((m) => m.conversationId),
    [CONVEX_CHAT_ID],
  )
})

test('pure guest: nothing is cleared and local chats show right away', () => {
  assert.deepEqual(decideLocalDataOwner(null, { status: 'pending' }), {
    clear: false,
    nextOwner: undefined,
    visible: true,
  })
  assert.deepEqual(decideLocalDataOwner(null, { status: 'signed-out' }), {
    clear: false,
    nextOwner: null,
    visible: true,
  })
})

test('first sign-in keeps guest chats so they can be imported, and records the owner', () => {
  assert.deepEqual(decideLocalDataOwner(null, { status: 'signed-in', userId: 'userA' }), {
    clear: false,
    nextOwner: 'userA',
    visible: true,
  })
  // Reloads while still signed in change nothing.
  assert.deepEqual(decideLocalDataOwner('userA', { status: 'signed-in', userId: 'userA' }), {
    clear: false,
    nextOwner: 'userA',
    visible: true,
  })
})

test('sign-out or session expiry wipes the previous user’s local chats', () => {
  assert.deepEqual(decideLocalDataOwner('userA', { status: 'signed-out' }), {
    clear: true,
    nextOwner: null,
    visible: true,
  })
})

test('a different account signing in wipes the previous user’s local chats', () => {
  assert.deepEqual(decideLocalDataOwner('userA', { status: 'signed-in', userId: 'userB' }), {
    clear: true,
    nextOwner: 'userB',
    visible: true,
  })
})

test('while the session is unknown, a previous owner’s chats stay hidden and are not deleted', () => {
  for (const status of ['pending', 'unknown'] as const) {
    assert.deepEqual(decideLocalDataOwner('userA', { status }), {
      clear: false,
      nextOwner: undefined,
      visible: false,
    })
  }
})

test('session keys differ per user so stale results are discarded', () => {
  assert.notEqual(
    localSessionKey({ status: 'signed-in', userId: 'userA' }),
    localSessionKey({ status: 'signed-in', userId: 'userB' }),
  )
  assert.notEqual(localSessionKey({ status: 'signed-out' }), localSessionKey({ status: 'pending' }))
})
