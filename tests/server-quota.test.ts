// Server-key usage limits: request signing between /api/chat and Convex, windows and model config.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_MODEL_ID } from '../src/lib/models'
import {
  QUOTA_WINDOW_MS,
  SIGNATURE_MAX_AGE_MS,
  guestSubject,
  isServerKeyModel,
  quotaWindowStart,
  serverModelLimits,
  signQuotaRequest,
  verifyQuotaRequest,
} from '../src/lib/serverQuota'

const secret = 'test-secret'

test('a signed request verifies, and only for the same action, model and subject', async () => {
  const now = 1_800_000_000_000
  const signed = await signQuotaRequest(secret, { subject: 'g_abc', modelId: DEFAULT_MODEL_ID, action: 'consume' }, now)
  assert.equal(await verifyQuotaRequest(secret, signed, now), true)
  assert.equal(await verifyQuotaRequest(secret, { ...signed, action: 'cooldown' }, now), false)
  assert.equal(await verifyQuotaRequest(secret, { ...signed, modelId: 'other' }, now), false)
  assert.equal(await verifyQuotaRequest(secret, { ...signed, subject: 'g_other' }, now), false)
  assert.equal(await verifyQuotaRequest('wrong', signed, now), false)
  assert.equal(await verifyQuotaRequest('', signed, now), false)
})

test('signatures expire', async () => {
  const now = 1_800_000_000_000
  const signed = await signQuotaRequest(secret, { subject: 'g_abc', modelId: DEFAULT_MODEL_ID, action: 'consume' }, now)
  assert.equal(await verifyQuotaRequest(secret, signed, now + SIGNATURE_MAX_AGE_MS + 1), false)
})

test('guest ids are stable per IP and do not contain it', async () => {
  const a = await guestSubject(secret, '203.0.113.7')
  assert.equal(a, await guestSubject(secret, '203.0.113.7'))
  assert.notEqual(a, await guestSubject(secret, '203.0.113.8'))
  assert.ok(!a.includes('203'))
})

test('windows are fixed days', () => {
  const start = quotaWindowStart(5 * QUOTA_WINDOW_MS + 123)
  assert.equal(start, 5 * QUOTA_WINDOW_MS)
  assert.equal(quotaWindowStart(start + QUOTA_WINDOW_MS - 1), start)
})

test('the default model runs on a server key with its own, tighter limits', () => {
  assert.ok(isServerKeyModel(DEFAULT_MODEL_ID))
  assert.ok(!isServerKeyModel('claude-opus-5-5'))
  const luna = serverModelLimits(DEFAULT_MODEL_ID)
  assert.ok(luna.guest < luna.user && luna.user < luna.global)
})
