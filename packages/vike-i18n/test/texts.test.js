// The `exports["texts"]` resolver (#102): enumerate installed extensions' source-text
// catalogs from package.json WITHOUT importing their code. Driven against a throwaway
// on-disk fixture app so the node_modules walk is exercised for real.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readTextsExport, discoverTextCatalogs, mergeSources } from '../texts.js'

// Build a fake app dir: package.json with deps + a node_modules tree where each named
// package has its own package.json (and optional texts.json). Returns the app root.
function makeApp(spec) {
  const root = mkdtempSync(join(tmpdir(), 'vike-i18n-texts-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify(spec.app))
  for (const [name, pkg] of Object.entries(spec.modules || {})) {
    const dir = join(root, 'node_modules', ...name.split('/'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg.packageJson))
    if (pkg.texts) writeFileSync(join(dir, 'texts.json'), JSON.stringify(pkg.texts))
  }
  return root
}

test('readTextsExport reads the string and conditional-object forms', () => {
  assert.equal(readTextsExport({ exports: { texts: './texts.json' } }), './texts.json')
  assert.equal(readTextsExport({ exports: { texts: { default: './t.json' } } }), './t.json')
  assert.equal(readTextsExport({ exports: { texts: { import: './i.json' } } }), './i.json')
  assert.equal(readTextsExport({ exports: {} }), null)
  assert.equal(readTextsExport({}), null)
})

test('discoverTextCatalogs enumerates installed extensions advertising texts', () => {
  const root = makeApp({
    app: { name: 'my-app', dependencies: { 'vike-auth': '*', 'vike-billing': '*', 'left-pad': '*' } },
    modules: {
      'vike-auth': {
        packageJson: { name: 'vike-auth', exports: { texts: './texts.json' } },
        texts: { 'auth.signIn': 'Sign in' },
      },
      'vike-billing': {
        packageJson: { name: 'vike-billing', exports: { texts: './texts.json' } },
        texts: { 'billing.pay': 'Pay' },
      },
      // a normal dep with no texts export — must be skipped, not crash
      'left-pad': { packageJson: { name: 'left-pad' } },
    },
  })
  try {
    const catalogs = discoverTextCatalogs({ root })
    assert.equal(catalogs.length, 2)
    const sources = mergeSources(catalogs)
    assert.deepEqual(sources, { 'auth.signIn': 'Sign in', 'billing.pay': 'Pay' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the app's own texts are discovered last (highest precedence override)", () => {
  const root = makeApp({
    app: { name: 'my-app', exports: { texts: './texts.json' }, dependencies: { 'vike-auth': '*' } },
    modules: {
      'vike-auth': {
        packageJson: { name: 'vike-auth', exports: { texts: './texts.json' } },
        texts: { 'auth.signIn': 'Sign in', 'auth.email': 'Email' },
      },
    },
  })
  // The app overrides one of the extension's source strings.
  writeFileSync(join(root, 'texts.json'), JSON.stringify({ 'auth.signIn': 'Log in', 'app.title': 'Acme' }))
  try {
    const catalogs = discoverTextCatalogs({ root })
    // extensions first, app last
    assert.equal(catalogs[catalogs.length - 1].pkg, 'my-app')
    const sources = mergeSources(catalogs)
    assert.equal(sources['auth.signIn'], 'Log in') // app override wins
    assert.equal(sources['auth.email'], 'Email') // untouched extension key
    assert.equal(sources['app.title'], 'Acme')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('discovery covers devDependencies and peerDependencies too', () => {
  const root = makeApp({
    app: { name: 'my-app', devDependencies: { 'vike-x': '*' }, peerDependencies: { 'vike-y': '*' } },
    modules: {
      'vike-x': { packageJson: { name: 'vike-x', exports: { texts: './texts.json' } }, texts: { 'x.a': 'A' } },
      'vike-y': { packageJson: { name: 'vike-y', exports: { texts: './texts.json' } }, texts: { 'y.b': 'B' } },
    },
  })
  try {
    assert.deepEqual(mergeSources(discoverTextCatalogs({ root })), { 'x.a': 'A', 'y.b': 'B' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
