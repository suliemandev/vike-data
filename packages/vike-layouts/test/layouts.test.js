// The layout core resolves an app's selection + slot config into a normalized
// descriptor the (per-framework) shells render from. Pin that contract.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shells, registerShell, isAppShell, defineLayout } from '../index.js'
import config from '../+config.js'

test('ships the three preset shells with kinds', () => {
  const s = shells()
  assert.equal(s.centered.kind, 'public')
  assert.equal(s.topbar.kind, 'app')
  assert.equal(s.sidebar.kind, 'app')
})

test('isAppShell distinguishes app chrome from public shells', () => {
  assert.equal(isAppShell('topbar'), true)
  assert.equal(isAppShell('centered'), false)
  assert.equal(isAppShell('nope'), false)
})

test('defineLayout defaults to the centered public shell', () => {
  const l = defineLayout()
  assert.equal(l.shell, 'centered')
  assert.equal(l.kind, 'public')
  assert.equal(l.dir, 'ltr')
})

test('an unknown shell falls back to centered', () => {
  assert.equal(defineLayout({ shell: 'hologram' }).shell, 'centered')
})

test('defineLayout carries the rtl/ltr direction', () => {
  assert.equal(defineLayout({ dir: 'rtl' }).dir, 'rtl')
  assert.equal(defineLayout({ dir: 'bogus' }).dir, 'ltr')
})

test('an app shell keeps the slots it renders', () => {
  const nav = [{ label: 'Home', href: '/' }]
  const l = defineLayout({ shell: 'topbar', logo: 'Acme', nav, userMenu: 'menu', footer: ['x'] })
  assert.equal(l.slots.logo, 'Acme')
  assert.deepEqual(l.slots.nav, nav)
  assert.equal(l.slots.userMenu, 'menu')
  assert.deepEqual(l.slots.footer, ['x'])
})

test('the centered shell ignores app-only slots (nav/userMenu/footer)', () => {
  const l = defineLayout({ shell: 'centered', logo: 'Acme', nav: [{ label: 'X', href: '/x' }], userMenu: 'm' })
  assert.equal(l.slots.logo, 'Acme') // centered renders logo
  assert.deepEqual(l.slots.nav, []) // but not nav
  assert.equal(l.slots.userMenu, null)
})

test('registerShell adds a 4th shell (open registry)', () => {
  registerShell('split', { kind: 'app', slots: ['logo', 'nav'] })
  assert.equal(isAppShell('split'), true)
  const l = defineLayout({ shell: 'split', logo: 'L', nav: [{ label: 'A', href: '/a' }], userMenu: 'ignored' })
  assert.equal(l.shell, 'split')
  assert.equal(l.slots.userMenu, null) // not in this shell's slots
})

test('registerShell validates its arguments', () => {
  assert.throws(() => registerShell('', { slots: [] }), /non-empty string/)
  assert.throws(() => registerShell('x', {}), /slots must be an array/)
})

test('+config declares the layout selection + slot config points', () => {
  assert.equal(config.meta.layout.env.client, true) // shell selection, client-available
  assert.equal(config.meta.nav.cumulative, true) // extensions can contribute nav links
  assert.equal(config.layout, 'centered') // safe public default
})
