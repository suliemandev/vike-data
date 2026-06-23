// The toolbar core is pure composition: normalize an extension's items, then compose
// the cumulative registry into the ordered, de-duped list the popover renders. Control
// is opaque here (a per-framework component) — a string stands in for it in these tests.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineToolbarItems, allToolbarItems } from '../index.js'
import config from '../+config.js'

const ctrl = (name) => `<${name}>` // stand-in for a control component

test('defineToolbarItems fills defaults and drops control-less entries', () => {
  const items = defineToolbarItems([
    { id: 'theme', label: 'Appearance', order: 10, Control: ctrl('Theme') },
    { label: 'no id, gets one', Control: ctrl('X') },
    { id: 'broken' }, // no Control -> dropped
  ])
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { id: 'theme', label: 'Appearance', order: 10, Control: ctrl('Theme') })
  assert.equal(items[1].id, 'item-1') // index-based default id
  assert.equal(items[1].order, 0) // default order
})

test('defineToolbarItems accepts a single item (not just an array)', () => {
  const items = defineToolbarItems({ id: 'solo', Control: ctrl('Solo') })
  assert.deepEqual(items.map((i) => i.id), ['solo'])
})

test('allToolbarItems flattens the cumulative registry and drops empties', () => {
  const composed = allToolbarItems([
    [{ id: 'a', Control: ctrl('A') }],
    [{ id: 'b', Control: ctrl('B') }, null],
    undefined,
  ])
  assert.deepEqual(composed.map((i) => i.id), ['a', 'b'])
})

test('allToolbarItems sorts by order (stable for ties)', () => {
  const composed = allToolbarItems([
    [{ id: 'late', order: 100, Control: ctrl('L') }],
    [{ id: 'first', order: 1, Control: ctrl('F') }],
    [{ id: 'tieA', order: 50, Control: ctrl('A') }],
    [{ id: 'tieB', order: 50, Control: ctrl('B') }],
  ])
  // 1, then the two 50s in contribution order, then 100
  assert.deepEqual(composed.map((i) => i.id), ['first', 'tieA', 'tieB', 'late'])
})

test('allToolbarItems de-dupes by id (first contribution wins)', () => {
  const composed = allToolbarItems([
    [{ id: 'theme', label: 'first', Control: ctrl('A') }],
    [{ id: 'theme', label: 'second', Control: ctrl('B') }],
  ])
  assert.equal(composed.length, 1)
  assert.equal(composed[0].label, 'first')
})

test('+config declares the cumulative toolbarItems seam (config+server+client)', () => {
  assert.equal(config.meta.toolbarItems.cumulative, true)
  assert.equal(config.meta.toolbarItems.env.client, true)
  assert.equal(config.meta.toolbarItems.env.server, true)
  assert.deepEqual(config.toolbarItems, [])
})
