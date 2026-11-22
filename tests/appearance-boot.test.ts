import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { buildSync } from 'esbuild'
import {
  APPEARANCE_BOOT_ID, APPEARANCE_STORAGE_KEY, APPEARANCE_STYLE_ID, DEFAULT_APPEARANCE,
  computeVars, varsToCss, type Appearance,
} from '../src/lib/theme/appearance'
import { APPEARANCE_ACCOUNT_STORAGE_KEY, APPEARANCE_ACTIVE_STORAGE_KEY } from '../src/lib/theme/store'

const script = buildSync({ entryPoints: ['src/lib/theme/boot.ts'], bundle: true, minify: true, write: false }).outputFiles[0].text
const saved: Appearance = {
  ...DEFAULT_APPEARANCE, updatedAt: 10, themeId: 'nord', font: 'serif', codeFont: 'consolas',
  accent: 'teal', uiScale: 1.25, codeSize: 18, density: 'compact',
}
const remote = { userId: 'account-a', appearance: saved, legacy: { mainFont: null, codeFont: null } }

function firstPaint(account: typeof remote | null, local: Record<string, unknown> = {}, cookie = '') {
  const storage = new Map(Object.entries(local).map(([key, value]) => [key, JSON.stringify(value)]))
  const elements = new Map<string, { textContent?: string; dataset?: { account: string } }>()
  elements.set(APPEARANCE_BOOT_ID, { dataset: { account: JSON.stringify(account) } })
  runInNewContext(script, {
    window: { localStorage: { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v) } },
    document: {
      cookie,
      getElementById: (id: string) => elements.get(id),
      createElement: () => ({}),
      head: { appendChild: (el: { id: string; textContent: string }) => elements.set(el.id, el) },
    },
  })
  return elements.get(APPEARANCE_STYLE_ID)?.textContent
}

test('a fresh device paints the signed-in account before hydration', () => {
  assert.equal(firstPaint(remote), varsToCss(computeVars(saved)))
})

test('a newer device edit wins only for its owner', () => {
  const newer: Appearance = { ...saved, updatedAt: 11, font: 'atkinson' }
  const cached = (owner: string) => ({
    [APPEARANCE_ACCOUNT_STORAGE_KEY]: { owner, appearance: newer },
    [APPEARANCE_ACTIVE_STORAGE_KEY]: owner,
  })
  assert.equal(firstPaint(remote, cached(remote.userId)), varsToCss(computeVars(newer)))
  assert.equal(firstPaint(remote, cached('account-b')), varsToCss(computeVars(saved)))
})

test('guests paint their local preferences even after switching out of an account', () => {
  assert.equal(firstPaint(null, {
    [APPEARANCE_STORAGE_KEY]: saved,
    [APPEARANCE_ACCOUNT_STORAGE_KEY]: { owner: remote.userId, appearance: DEFAULT_APPEARANCE },
    [APPEARANCE_ACTIVE_STORAGE_KEY]: remote.userId,
  }), varsToCss(computeVars(saved)))
  assert.equal(firstPaint(null), varsToCss(computeVars(DEFAULT_APPEARANCE)))
  assert.equal(firstPaint(null, {}, 'mainFont=serif'), varsToCss(computeVars({ ...DEFAULT_APPEARANCE, font: 'serif' })))
})
