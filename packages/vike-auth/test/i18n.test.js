// Language subpaths (#76): vike-auth ships English inline and exposes other
// languages as SUBPATHS (vike-auth/fr, vike-auth/ar). These guard the catalogs:
// a language must not invent keys English lacks (orphans never render), Arabic is
// a FULL translation, and interpolation placeholders survive translation.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authMessages } from '../react/messages.js'
import { authMessagesFr } from '../fr/messages.js'
import { authMessagesAr } from '../ar/messages.js'

const en = authMessages.en
const fr = authMessagesFr.fr
const ar = authMessagesAr.ar
const placeholders = (s) => (s.match(/\{(\w+)\}/g) || []).sort()

test('English is the inline base catalog (the universal fallback)', () => {
  assert.ok(Object.keys(en).length > 0)
  assert.ok(en['auth.signIn'] && en['auth.accountTitle']) // login + account keys
})

test('every language key exists in English (no orphan keys that never render)', () => {
  for (const [lang, dict] of [['fr', fr], ['ar', ar]]) {
    for (const key of Object.keys(dict)) {
      assert.ok(key in en, `${lang} has orphan key "${key}" not in English`)
    }
  }
})

test('French is a partial pack (missing keys fall back to inline English)', () => {
  // fr intentionally omits the account.* keys -> they render English via fallback.
  assert.ok(!('auth.accountTitle' in fr))
  assert.ok('auth.signIn' in fr) // but covers the login surface
})

test('Arabic is a FULL translation (covers every English key)', () => {
  for (const key of Object.keys(en)) {
    assert.ok(key in ar, `ar is missing "${key}"`)
  }
})

test('interpolation placeholders survive translation ({app}, {email})', () => {
  for (const [lang, dict] of [['fr', fr], ['ar', ar]]) {
    for (const key of Object.keys(dict)) {
      assert.deepEqual(
        placeholders(dict[key]),
        placeholders(en[key]),
        `${lang} "${key}" placeholders diverge from English`,
      )
    }
  }
})
