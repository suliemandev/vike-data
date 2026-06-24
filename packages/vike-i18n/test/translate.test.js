// The pure tier-2 core (#102): hashing, staleness planning, incremental merge, and
// the bridge into the runtime `messages` shape. No I/O, no AI — just the policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  hashSource,
  sourceHashes,
  planTranslations,
  isStale,
  applyTranslations,
  committedMessages,
  SOURCES_KEY,
} from '../translate.js'

const SOURCES = {
  'auth.signIn': 'Sign in to {app}',
  'auth.email': 'Email',
}

test('hashSource is stable, deterministic, and content-sensitive', () => {
  assert.equal(hashSource('Email'), hashSource('Email'))
  assert.notEqual(hashSource('Email'), hashSource('E-mail'))
  assert.match(hashSource('anything'), /^[0-9a-f]{8}$/)
})

test('plan: a fresh file needs every target locale x key (English excluded)', () => {
  const { items } = planTranslations(SOURCES, ['en', 'fr', 'ar'], {})
  // 2 keys x 2 target locales (fr, ar) = 4; en is never a target
  assert.equal(items.length, 4)
  assert.ok(items.every((i) => i.locale !== 'en'))
  assert.deepEqual(new Set(items.map((i) => i.locale)), new Set(['fr', 'ar']))
})

test('plan: nothing to do when every key is translated and sources are unchanged', () => {
  const existing = {
    [SOURCES_KEY]: sourceHashes(SOURCES),
    fr: { 'auth.signIn': 'Connexion à {app}', 'auth.email': 'E-mail' },
  }
  assert.deepEqual(planTranslations(SOURCES, ['fr'], existing).items, [])
  assert.equal(isStale(SOURCES, ['fr'], existing), false)
})

test('plan: a changed English source marks that key stale for every locale', () => {
  const existing = {
    [SOURCES_KEY]: sourceHashes(SOURCES),
    fr: { 'auth.signIn': 'Connexion à {app}', 'auth.email': 'E-mail' },
  }
  const changed = { ...SOURCES, 'auth.email': 'Email address' }
  const { items, staleKeys } = planTranslations(changed, ['fr'], existing)
  assert.ok(staleKeys.has('auth.email'))
  assert.deepEqual(items, [{ locale: 'fr', key: 'auth.email', source: 'Email address' }])
  assert.equal(isStale(changed, ['fr'], existing), true)
})

test('plan: a missing key for one locale is flagged even if sources are unchanged', () => {
  const existing = {
    [SOURCES_KEY]: sourceHashes(SOURCES),
    fr: { 'auth.signIn': 'Connexion à {app}' }, // auth.email missing
  }
  const { items } = planTranslations(SOURCES, ['fr'], existing)
  assert.deepEqual(items, [{ locale: 'fr', key: 'auth.email', source: 'Email' }])
})

test('plan: a key removed from the source is reported for pruning', () => {
  const existing = { [SOURCES_KEY]: sourceHashes({ ...SOURCES, 'auth.gone': 'Old' }) }
  const { removedKeys } = planTranslations(SOURCES, ['fr'], existing)
  assert.deepEqual(removedKeys, ['auth.gone'])
  assert.equal(isStale(SOURCES, ['fr'], existing), true)
})

test('apply: writes current $sources and the freshly translated values', () => {
  const results = [
    { locale: 'fr', key: 'auth.signIn', value: 'Connexion à {app}' },
    { locale: 'fr', key: 'auth.email', value: 'E-mail' },
  ]
  const merged = applyTranslations({}, SOURCES, ['en', 'fr'], results)
  assert.deepEqual(merged[SOURCES_KEY], sourceHashes(SOURCES))
  assert.deepEqual(merged.fr, { 'auth.signIn': 'Connexion à {app}', 'auth.email': 'E-mail' })
  assert.equal('en' in merged, false) // English is never written as a translation
})

test('apply: preserves an unchanged hand-edited translation across a re-run', () => {
  const existing = {
    [SOURCES_KEY]: sourceHashes(SOURCES),
    fr: { 'auth.signIn': 'HAND EDIT {app}', 'auth.email': 'E-mail' },
  }
  // Re-run with no new results (nothing was stale/missing) keeps the hand edit.
  const merged = applyTranslations(existing, SOURCES, ['fr'], [])
  assert.equal(merged.fr['auth.signIn'], 'HAND EDIT {app}')
})

test('apply: drops a stale value the run did not refill (so it falls back + re-flags)', () => {
  const existing = {
    [SOURCES_KEY]: sourceHashes(SOURCES),
    fr: { 'auth.signIn': 'Connexion à {app}', 'auth.email': 'E-mail' },
  }
  const changed = { ...SOURCES, 'auth.email': 'Email address' }
  // Source changed for auth.email but the translator returned nothing for it.
  const merged = applyTranslations(existing, changed, ['fr'], [])
  assert.equal('auth.email' in merged.fr, false) // stale value dropped
  assert.equal(merged.fr['auth.signIn'], 'Connexion à {app}') // unchanged one kept
  // $sources updated, but the dropped value is still a gap -> a fresh check fails.
  assert.equal(isStale(changed, ['fr'], merged), true)
})

test('apply: prunes keys removed from the source', () => {
  const existing = {
    [SOURCES_KEY]: sourceHashes({ ...SOURCES, 'auth.gone': 'Old' }),
    fr: { 'auth.signIn': 'Connexion à {app}', 'auth.email': 'E-mail', 'auth.gone': 'Vieux' },
  }
  const merged = applyTranslations(existing, SOURCES, ['fr'], [])
  assert.equal('auth.gone' in merged.fr, false)
  assert.equal('auth.gone' in merged[SOURCES_KEY], false)
})

test('apply -> check is a fixpoint: a full pass leaves nothing stale', () => {
  const results = [
    { locale: 'ar', key: 'auth.signIn', value: 'تسجيل الدخول إلى {app}' },
    { locale: 'ar', key: 'auth.email', value: 'البريد الإلكتروني' },
  ]
  const merged = applyTranslations({}, SOURCES, ['ar'], results)
  assert.equal(isStale(SOURCES, ['ar'], merged), false)
})

test('committedMessages strips $sources and yields the runtime messages shape', () => {
  const translation = {
    [SOURCES_KEY]: { 'auth.email': 'abc' },
    ar: { 'auth.email': 'البريد الإلكتروني' },
    fr: { 'auth.email': 'E-mail' },
  }
  const msgs = committedMessages(translation)
  assert.deepEqual(msgs, { ar: { 'auth.email': 'البريد الإلكتروني' }, fr: { 'auth.email': 'E-mail' } })
  assert.equal(SOURCES_KEY in msgs, false)
})
