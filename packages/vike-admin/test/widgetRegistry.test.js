// The field-widget registry, exercised without React: register / get / fallback / validation.
// The built-in widget COMPONENTS (JSX) register themselves from ./react/widgets.jsx, which the
// running app imports; here we test the plain registry mechanism an extension uses to add its
// own control (e.g. vike-storage's `file`, #178).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerFieldWidget, getFieldWidget, fieldWidgetTokens } from '../react/widget-registry.js'

test('registerFieldWidget stores a component retrievable by token', () => {
  const File = () => null
  registerFieldWidget('test-file', File)
  assert.equal(getFieldWidget('test-file'), File)
  assert.ok(fieldWidgetTokens().includes('test-file'))
})

test('a later registration overrides an earlier one (an app can swap a built-in)', () => {
  const A = () => null
  const B = () => null
  registerFieldWidget('test-dup', A)
  registerFieldWidget('test-dup', B)
  assert.equal(getFieldWidget('test-dup'), B)
})

test('getFieldWidget returns undefined for an unregistered token (caller falls back)', () => {
  assert.equal(getFieldWidget('test-nope'), undefined)
})

test('registerFieldWidget rejects a bad token or a non-component', () => {
  assert.throws(() => registerFieldWidget('', () => null), /non-empty string/)
  assert.throws(() => registerFieldWidget(42, () => null), /non-empty string/)
  assert.throws(() => registerFieldWidget('x', 'not-a-component'), /must be a function/)
})
