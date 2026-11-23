// Model picker preferences: provider/model hiding, "show only available", and selected-model fallback.
// Run: node --import ./tests/register-ts.mjs --test "tests/**/*.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_MODEL_ID, models } from '../src/lib/models'
import {
  DEFAULT_MODEL_PREFERENCES,
  getPickerModels,
  getSelectableModels,
  isModelUsable,
  resolveSelectedModel,
  type ModelAccess,
} from '../src/lib/modelPreferences'

const guest: ModelAccess = { isSignedIn: false, keyProviders: [] }
const signedIn: ModelAccess = { isSignedIn: true, keyProviders: [] }
const withAnthropic: ModelAccess = { isSignedIn: true, keyProviders: ['anthropic'] }
const claude = models.find((m) => m.provider === 'anthropic')!

test('default preferences list every model', () => {
  assert.equal(getPickerModels(DEFAULT_MODEL_PREFERENCES, signedIn).length, models.length)
})

test('key-only models need a key for their provider', () => {
  assert.equal(isModelUsable(claude, signedIn), false)
  assert.equal(isModelUsable(claude, withAnthropic), true)
  assert.equal(isModelUsable(claude, guest), false)
})

test('disabling a provider hides all of its models', () => {
  const prefs = { ...DEFAULT_MODEL_PREFERENCES, disabledProviders: ['anthropic'] }
  assert.ok(getPickerModels(prefs, withAnthropic).every((m) => m.provider !== 'anthropic'))
})

test('show only available hides unusable models', () => {
  const prefs = { ...DEFAULT_MODEL_PREFERENCES, showOnlyAvailable: true }
  const picker = getPickerModels(prefs, signedIn)
  assert.ok(picker.every((m) => isModelUsable(m, signedIn)))
  assert.ok(!picker.some((m) => m.provider === 'anthropic'))
  assert.ok(getPickerModels(prefs, withAnthropic).some((m) => m.provider === 'anthropic'))
})

test('the picker is never empty: the default model survives every filter', () => {
  const everything = {
    disabledModels: models.map((m) => m.id),
    disabledProviders: ['gemini', 'groq', 'openrouter', 'anthropic', 'openai'],
    showOnlyAvailable: true,
  }
  for (const access of [guest, signedIn, withAnthropic]) {
    const ids = getSelectableModels(everything, access).map((m) => m.id)
    assert.deepEqual(ids, [DEFAULT_MODEL_ID])
  }
})

test('unavailable server-key models are hidden unless the user has their own key', () => {
  const blocked = { serverUnavailable: [DEFAULT_MODEL_ID] }
  const ids = (access: ModelAccess) => getPickerModels(DEFAULT_MODEL_PREFERENCES, access).map((m) => m.id)
  assert.ok(!ids({ ...guest, ...blocked }).includes(DEFAULT_MODEL_ID))
  assert.ok(ids({ isSignedIn: true, keyProviders: ['openai'], ...blocked }).includes(DEFAULT_MODEL_ID))
  // The saved default falls back to another free model
  const fallback = resolveSelectedModel(DEFAULT_MODEL_ID, DEFAULT_MODEL_PREFERENCES, { ...guest, ...blocked })
  assert.notEqual(fallback.id, DEFAULT_MODEL_ID)
  assert.ok(fallback.isFree)
})

test('the picker still lists one model when every free model is unavailable', () => {
  const access = { ...guest, serverUnavailable: models.filter((m) => m.isFree).map((m) => m.id) }
  const free = (prefs = DEFAULT_MODEL_PREFERENCES) =>
    getPickerModels(prefs, access)
      .filter((m) => m.isFree)
      .map((m) => m.id)
  assert.deepEqual(free(), [DEFAULT_MODEL_ID])
  assert.deepEqual(
    getPickerModels({ ...DEFAULT_MODEL_PREFERENCES, showOnlyAvailable: true }, access).map((m) => m.id),
    [DEFAULT_MODEL_ID],
  )
})

test('saved model is restored when selectable', () => {
  assert.equal(resolveSelectedModel(claude.id, DEFAULT_MODEL_PREFERENCES, withAnthropic).id, claude.id)
})

test('saved model falls back to the default when missing, disabled or unusable', () => {
  const fallback = (id: string | null, prefs = DEFAULT_MODEL_PREFERENCES, access = withAnthropic) =>
    resolveSelectedModel(id, prefs, access).id
  assert.equal(fallback('model-that-was-removed'), DEFAULT_MODEL_ID)
  assert.equal(fallback(null), DEFAULT_MODEL_ID)
  assert.equal(fallback(claude.id, { ...DEFAULT_MODEL_PREFERENCES, disabledModels: [claude.id] }), DEFAULT_MODEL_ID)
  assert.equal(fallback(claude.id, { ...DEFAULT_MODEL_PREFERENCES, disabledProviders: ['anthropic'] }), DEFAULT_MODEL_ID)
  assert.equal(fallback(claude.id, DEFAULT_MODEL_PREFERENCES, signedIn), DEFAULT_MODEL_ID)
  assert.equal(fallback(claude.id, DEFAULT_MODEL_PREFERENCES, guest), DEFAULT_MODEL_ID)
})
