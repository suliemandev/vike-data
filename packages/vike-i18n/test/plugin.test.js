// Unit tests for the zero-config `lang: [...]` virtual-module plugin (#79). These
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

test('only locales in `lang` are imported (per-locale tree-shaking)', () => {
  const reg = flattenRegistry(REGISTRY_RAW, {})

  // lang includes fr but NOT ar -> only the fr catalog is imported; ar is absent
  // from the module entirely, so Vite never bundles it.
  const out = generateModule(['en', 'fr'], reg)
  assert.match(out, /import pack0 from "vike-auth\/fr\/messages"/)
  assert.doesNotMatch(out, /ar\/messages/)
  assert.match(out, /export const packs = \[pack0\]/)
})

test('all advertised locales light up when all are in `lang`', () => {
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
