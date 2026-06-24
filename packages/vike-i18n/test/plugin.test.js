// Unit tests for the zero-config `locales: [...]` virtual-module plugin (#79). These
// pin the PURE logic that decides which catalogs get statically imported (the
// tree-shaking claim) — the side that doesn't need a running Vite/Vike.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flattenRegistry, generateModule } from '../plugin.js'

// A realistic registry: one extension advertising two packs, the way vike-auth's
// +config.js contributes it (an array with one map). Vike hands cumulative configs
// in as an array-of-contributions, each itself possibly an array.
const REGISTRY_RAW = [[{ fr: 'vike-auth/fr/messages', ar: 'vike-auth/ar/messages' }]]

test('flattenRegistry normalizes nested arrays + functions to a flat list of maps', () => {
  const flat = flattenRegistry(REGISTRY_RAW, {})
  assert.deepEqual(flat, [{ fr: 'vike-auth/fr/messages', ar: 'vike-auth/ar/messages' }])

  // a function contribution is resolved against the config, like resolveSchemas
  const withFn = flattenRegistry([[(c) => ({ de: `vike-x/${c.region}/de` })]], { region: 'eu' })
  assert.deepEqual(withFn, [{ de: 'vike-x/eu/de' }])

  assert.deepEqual(flattenRegistry(undefined, {}), [])
  assert.deepEqual(flattenRegistry([], {}), [])
})

test('only locales in `locales` are imported (per-locale tree-shaking)', () => {
  const reg = flattenRegistry(REGISTRY_RAW, {})

  // locales includes fr but NOT ar -> only the fr catalog is imported; ar is absent
  // from the module entirely, so Vite never bundles it.
  const out = generateModule(['en', 'fr'], reg)
  assert.match(out, /import pack0 from "vike-auth\/fr\/messages"/)
  assert.doesNotMatch(out, /ar\/messages/)
  assert.match(out, /export const packs = \[pack0\]/)
})

test('all advertised locales light up when all are in `locales`', () => {
  const reg = flattenRegistry(REGISTRY_RAW, {})
  const out = generateModule(['en', 'fr', 'ar'], reg)
  assert.match(out, /vike-auth\/fr\/messages/)
  assert.match(out, /vike-auth\/ar\/messages/)
  assert.match(out, /export const packs = \[pack0, pack1\]/)
})

test('English is never a pack (inline universal fallback), even if advertised', () => {
  const reg = flattenRegistry([[{ en: 'vike-auth/en/messages', fr: 'vike-auth/fr/messages' }]], {})
  const out = generateModule(['en', 'fr'], reg)
  assert.doesNotMatch(out, /en\/messages/)
  assert.match(out, /fr\/messages/)
})

test('no matching locales -> an empty packs module (still valid, import never fails)', () => {
  const out = generateModule(['en'], flattenRegistry(REGISTRY_RAW, {}))
  assert.match(out, /export const packs = \[\]/)
  assert.doesNotMatch(out, /^import/m)
})

test('multiple extensions advertising the same locale each contribute', () => {
  const reg = flattenRegistry(
    [[{ fr: 'vike-auth/fr/messages' }], [{ fr: 'vike-billing/fr/messages' }]],
    {},
  )
  const out = generateModule(['fr'], reg)
  assert.match(out, /vike-auth\/fr\/messages/)
  assert.match(out, /vike-billing\/fr\/messages/)
  assert.match(out, /export const packs = \[pack0, pack1\]/)
})

// Tier 2 (#102): the committed translation.json gets inlined into the same `packs`
// array, AFTER the bundled tier-1 imports so it wins (committed > pack > inline en).
const COMMITTED = { ar: { 'auth.signIn': 'تسجيل الدخول' }, fr: { 'auth.signIn': 'Connexion' } }

test('committed translations inline as literals after the imported packs', () => {
  const reg = flattenRegistry([[{ ar: 'vike-auth/ar/messages' }]], {})
  const out = generateModule(['en', 'ar'], reg, COMMITTED)
  // tier-1 ar pack is imported, tier-2 ar committed is inlined (not imported)
  assert.match(out, /import pack0 from "vike-auth\/ar\/messages"/)
  assert.match(out, /const committed1 = .*تسجيل الدخول/)
  // committed comes AFTER pack0 in the packs array -> later wins in mergeMessages
  assert.match(out, /export const packs = \[pack0, committed1\]/)
})

test('committed only inlines locales in `locales` (English + others tree-shake out)', () => {
  // fr is committed but not requested; en is never a target -> neither appears
  const out = generateModule(['en', 'ar'], [], COMMITTED)
  assert.match(out, /تسجيل الدخول/) // ar present
  assert.doesNotMatch(out, /Connexion/) // fr absent (not in locales)
  assert.match(out, /export const packs = \[committed0\]/)
})

test('no committed translations -> behaves exactly as before (back-compat)', () => {
  const out = generateModule(['en', 'ar'], flattenRegistry([[{ ar: 'vike-auth/ar/messages' }]], {}))
  assert.match(out, /export const packs = \[pack0\]/)
  assert.doesNotMatch(out, /committed/)
})
