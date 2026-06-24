// `vike translate` end to end (#102), against a throwaway fixture app and a FAKE
// provider (no network). Exercises arg parsing, write mode, --check drift gate,
// idempotency, and incremental re-translation of only the changed entries.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runTranslate, parseArgs } from '../cli.js'

function makeApp(authTexts) {
  const root = mkdtempSync(join(tmpdir(), 'vike-i18n-cli-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { 'vike-auth': '*' } }))
  const dir = join(root, 'node_modules', 'vike-auth')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'vike-auth', exports: { texts: './texts.json' } }))
  writeFileSync(join(dir, 'texts.json'), JSON.stringify(authTexts))
  return root
}

// A deterministic fake translator: prefixes each source with the locale tag. Records
// every batch it was asked to translate so tests can assert WHAT got (re)translated.
function fakeProvider() {
  const calls = []
  const translate = async ({ locale, items }) => {
    calls.push({ locale, keys: items.map((i) => i.key) })
    const out = {}
    for (const { key, source } of items) out[key] = `[${locale}] ${source}`
    return out
  }
  return { translate, calls }
}

const silent = () => {}

test('parseArgs handles flags, =forms, and lists', () => {
  assert.deepEqual(parseArgs(['--check']), { check: true })
  assert.deepEqual(parseArgs(['--locales', 'en,fr , ar']), { locales: ['en', 'fr', 'ar'] })
  assert.deepEqual(parseArgs(['--locales=fr,ar', '--root', '/x']), { locales: ['fr', 'ar'], root: '/x' })
  assert.equal(parseArgs(['--help']).help, true)
})

test('write mode translates the long tail and writes translation.json', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in to {app}', 'auth.email': 'Email' })
  const { translate, calls } = fakeProvider()
  try {
    const res = await runTranslate({ root, locales: ['en', 'fr', 'ar'], translate, log: silent })
    assert.equal(res.written, true)
    const file = JSON.parse(readFileSync(join(root, 'translation.json'), 'utf8'))
    assert.equal(file.fr['auth.signIn'], '[fr] Sign in to {app}')
    assert.equal(file.ar['auth.email'], '[ar] Email')
    assert.equal('en' in file, false) // English is never written
    // one batch per target locale (fr, ar) — not per key
    assert.deepEqual(new Set(calls.map((c) => c.locale)), new Set(['fr', 'ar']))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--check passes after a write and never calls the provider', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in', 'auth.email': 'Email' })
  const { translate, calls } = fakeProvider()
  try {
    await runTranslate({ root, locales: ['fr'], translate, log: silent })
    calls.length = 0
    const check = await runTranslate({ root, check: true, locales: ['fr'], translate, log: silent })
    assert.equal(check.ok, true)
    assert.equal(calls.length, 0) // check never translates
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--check fails when an extension adds a new source string', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in' })
  const { translate } = fakeProvider()
  try {
    await runTranslate({ root, locales: ['fr'], translate, log: silent })
    // The extension ships a new key (simulate an upgrade).
    writeFileSync(
      join(root, 'node_modules', 'vike-auth', 'texts.json'),
      JSON.stringify({ 'auth.signIn': 'Sign in', 'auth.email': 'Email' }),
    )
    const check = await runTranslate({ root, check: true, locales: ['fr'], translate, log: silent })
    assert.equal(check.ok, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('re-run is incremental: only the changed source is re-translated', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in to {app}', 'auth.email': 'Email' })
  const { translate, calls } = fakeProvider()
  try {
    await runTranslate({ root, locales: ['fr'], translate, log: silent })
    // Change ONE source string; the other must be reused, not re-translated.
    writeFileSync(
      join(root, 'node_modules', 'vike-auth', 'texts.json'),
      JSON.stringify({ 'auth.signIn': 'Log in to {app}', 'auth.email': 'Email' }),
    )
    calls.length = 0
    const res = await runTranslate({ root, locales: ['fr'], translate, log: silent })
    assert.deepEqual(calls, [{ locale: 'fr', keys: ['auth.signIn'] }]) // only the changed key
    assert.equal(res.translation.fr['auth.signIn'], '[fr] Log in to {app}')
    assert.equal(res.translation.fr['auth.email'], '[fr] Email') // reused from prior run
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a clean re-run writes nothing (idempotent)', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in' })
  const { translate } = fakeProvider()
  try {
    await runTranslate({ root, locales: ['fr', 'ar'], translate, log: silent })
    const second = await runTranslate({ root, locales: ['fr', 'ar'], translate, log: silent })
    assert.equal(second.written, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('locales default to those already present in translation.json', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in' })
  const { translate, calls } = fakeProvider()
  try {
    // seed with fr + ar, then re-run with NO locales option
    await runTranslate({ root, locales: ['fr', 'ar'], translate, log: silent })
    calls.length = 0
    // add a key so there is work, then run without locales
    writeFileSync(
      join(root, 'node_modules', 'vike-auth', 'texts.json'),
      JSON.stringify({ 'auth.signIn': 'Sign in', 'auth.email': 'Email' }),
    )
    await runTranslate({ root, translate, log: silent })
    assert.deepEqual(new Set(calls.map((c) => c.locale)), new Set(['fr', 'ar']))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('write mode with no target locales is a no-op (does not create the file)', async () => {
  const root = makeApp({ 'auth.signIn': 'Sign in' })
  const { translate } = fakeProvider()
  try {
    const res = await runTranslate({ root, locales: ['en'], translate, log: silent })
    assert.equal(res.written, false)
    assert.equal(existsSync(join(root, 'translation.json')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
