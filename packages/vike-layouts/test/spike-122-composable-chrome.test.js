// SPIKE #122 (epic #120) — proof that composable UI chrome (a toolbar / settings
// popover layer) composes through the mechanics vike-layouts ALREADY has — the open
// shell registry (registerShell) + slot resolution (defineLayout) + cumulative seams
// (like `nav`) — WITHOUT splitting the package into core/nav/chrome/wrapper and
// WITHOUT a wrapper-layout extension. See the recommendation on the issue.
//
// The claim under test: a chrome layer is just (a) a shell that opts into a `toolbar`
// slot, and (b) settings items contributed cumulatively by SEPARATE extensions
// (vike-toolbar, vike-themes, ...). The layout core hosts them; it doesn't own them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineLayout, registerShell, isAppShell } from '../index.js'

test('a shell opts into a toolbar slot via the OPEN registry (no new package)', () => {
  // This is exactly how vike-toolbar (#121) would register an app shell that hosts a
  // settings popover — the same registerShell() a 4th shell already uses today.
  registerShell('topbar+chrome', { kind: 'app', slots: ['logo', 'nav', 'toolbar'] })
  assert.equal(isAppShell('topbar+chrome'), true)
})

test('the toolbar slot composes CUMULATIVE items from many sources, like nav', () => {
  registerShell('chrome-app', { kind: 'app', slots: ['logo', 'toolbar'] })
  // The cumulative `toolbar` config arrives as one flat list (vike-react flattens the
  // per-source arrays before defineLayout, same as it does for `nav`). Each item is a
  // settings entry a different extension advertised.
  const toolbar = [
    { id: 'theme', label: 'Theme' }, // from vike-themes (its ThemePicker)
    { id: 'locale', label: 'Language' }, // from vike-i18n
    { id: 'account', label: 'Account' }, // from the app
  ]
  const l = defineLayout({ shell: 'chrome-app', logo: 'Acme', toolbar })
  assert.deepEqual(
    l.slots.toolbar.map((i) => i.id),
    ['theme', 'locale', 'account'],
  )
})

test('chrome is orthogonal to the shell: a shell without the slot drops it', () => {
  // The built-in centered (public) shell carries no app chrome — auth/marketing pages
  // get no toolbar even if items are passed. Proves chrome is opt-in per shell, the
  // same guarantee `nav`/`userMenu` already have.
  const pub = defineLayout({ shell: 'centered', logo: 'Acme', toolbar: [{ id: 'theme' }] })
  assert.deepEqual(pub.slots.toolbar, [])
  // And an app shell that didn't opt into the slot also drops it.
  const noChrome = defineLayout({ shell: 'topbar', toolbar: [{ id: 'theme' }] })
  assert.deepEqual(noChrome.slots.toolbar, [])
})

test('chrome layer + nav layer + shell selection all compose in one descriptor', () => {
  // The "layers compose" claim, end to end: one defineLayout call resolves the shell
  // selection, the cumulative nav layer, AND the cumulative chrome layer together —
  // which is what a single (cumulative) vike-react Layout renders. No wrapper needed.
  registerShell('full', { kind: 'app', slots: ['logo', 'nav', 'toolbar'] })
  const l = defineLayout({
    shell: 'full',
    logo: 'Acme',
    nav: [{ label: 'Home', href: '/' }],
    toolbar: [{ id: 'theme', label: 'Theme' }],
  })
  assert.equal(l.shell, 'full')
  assert.deepEqual(l.slots.nav, [{ label: 'Home', href: '/' }])
  assert.deepEqual(l.slots.toolbar, [{ id: 'theme', label: 'Theme' }])
})
