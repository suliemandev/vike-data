// The i18n core is pure data: merge cumulative message contributions per locale,
// then look up + interpolate. These pin the composition + override contract.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineMessages, mergeMessages, translate, availableLocales } from '../index.js'
import config from '../+config.js'

const auth = defineMessages({
  en: { 'auth.signIn': 'Sign in', 'auth.email': 'Email' },
  fr: { 'auth.signIn': 'Connexion', 'auth.email': 'E-mail' },
})
const app = defineMessages({
  en: { 'app.title': 'Acme' },
  fr: { 'app.title': 'Acme' },
})

test('defineMessages passes the map through as plain data', () => {
  assert.equal(defineMessages(auth), auth)
})

test('mergeMessages composes contributions for a locale', () => {
  const fr = mergeMessages([[auth], [app]], 'fr')
  assert.equal(fr['auth.signIn'], 'Connexion')
  assert.equal(fr['app.title'], 'Acme')
})

test('a missing translation falls back to the fallback locale', () => {
  const partial = defineMessages({ en: { 'x.y': 'Hello' } }) // no fr
  const fr = mergeMessages([partial], 'fr')
  assert.equal(fr['x.y'], 'Hello') // filled from en
})

test('a later contribution overrides an earlier key (app overrides extension)', () => {
  const override = defineMessages({ en: { 'auth.signIn': 'Log in' } })
  const en = mergeMessages([auth, override], 'en')
  assert.equal(en['auth.signIn'], 'Log in')
})

test('the active locale overrides the fallback layer', () => {
  const en = mergeMessages([auth], 'en')
  const fr = mergeMessages([auth], 'fr')
  assert.equal(en['auth.signIn'], 'Sign in')
  assert.equal(fr['auth.signIn'], 'Connexion')
})

test('translate looks up a key and interpolates vars', () => {
  const dict = { greet: 'Hi {name}, welcome to {app}' }
  assert.equal(translate(dict, 'greet', { name: 'Sam', app: 'Acme' }), 'Hi Sam, welcome to Acme')
})

test('translate returns the key itself when missing (debuggable)', () => {
  assert.equal(translate({}, 'nope.key'), 'nope.key')
})

test('availableLocales lists every provided locale, fallback first', () => {
  assert.deepEqual(availableLocales([[auth], [app]]), ['en', 'fr'])
})

test('+config declares a locale selection + cumulative messages registry', () => {
  assert.equal(config.meta.locale.cumulative, undefined)
  assert.equal(config.meta.messages.cumulative, true)
  assert.equal(config.locale, 'en')
  assert.ok(config.passToClient.includes('localeCookie'))
})
