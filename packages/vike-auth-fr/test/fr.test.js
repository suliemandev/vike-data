// A locale pack is data; pin that it ships French for the auth keys and registers
// into the cumulative messages config. The key list mirrors vike-auth/react's en
// surface (kept in sync here so a forgotten key is caught; any genuinely missing
// one would fall back to English at runtime, not break).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translate } from 'vike-i18n'
import authMessagesFr from '../index.js'
import config from '../+config.js'

const EXPECTED_KEYS = [
  'auth.signIn', 'auth.subtitle', 'auth.email', 'auth.send', 'auth.sending',
  'auth.inboxTitle', 'auth.inboxBody', 'auth.devNote', 'auth.different',
  'auth.error', 'auth.footer', 'auth.signInShort', 'auth.logout',
]

test('ships French translations under the fr locale', () => {
  assert.ok(authMessagesFr.fr)
  assert.equal(authMessagesFr.fr['auth.signIn'], 'Connexion à {app}')
})

test('covers every auth.* key (in sync with the base)', () => {
  for (const k of EXPECTED_KEYS) {
    assert.ok(authMessagesFr.fr[k], `missing French translation for ${k}`)
  }
})

test('interpolation placeholders are preserved (e.g. {app}, {email})', () => {
  assert.equal(translate(authMessagesFr.fr, 'auth.signIn', { app: 'Acme' }), 'Connexion à Acme')
  assert.match(authMessagesFr.fr['auth.inboxBody'], /\{email\}/)
})

test('+config registers the pack into the cumulative messages point + self-installs vike-i18n', () => {
  assert.deepEqual(config.messages, [authMessagesFr])
  assert.ok(config.extends.includes('import:vike-i18n/config:default'))
})
