import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFieldWidgetRegistry } from '../index.js'

test('createFieldWidgetRegistry: register / get / tokens round-trip', () => {
  const r = createFieldWidgetRegistry('test-fw-a')
  const File = () => null
  assert.equal(r.get('file'), undefined) // unregistered -> undefined (caller falls back)
  assert.equal(r.register('file', File), File) // returns the component
  assert.equal(r.get('file'), File)
  assert.ok(r.tokens().includes('file'))
})

test('a later registration overrides an earlier one (an app can swap a built-in)', () => {
  const r = createFieldWidgetRegistry('test-fw-b')
  const A = () => null
  const B = () => null
  r.register('dup', A)
  r.register('dup', B)
  assert.equal(r.get('dup'), B)
})

test('two registries with the same name share one map', () => {
  const a = createFieldWidgetRegistry('test-fw-shared')
  const b = createFieldWidgetRegistry('test-fw-shared')
  const W = () => null
  a.register('x', W)
  assert.equal(b.get('x'), W) // b sees what a registered (the cross-package guarantee)
})

test('registries with different names are isolated', () => {
  const react = createFieldWidgetRegistry('test-fw-react')
  const vue = createFieldWidgetRegistry('test-fw-vue')
  react.register('file', () => null)
  assert.equal(vue.get('file'), undefined)
})

test('register rejects a bad token or a non-component', () => {
  const r = createFieldWidgetRegistry('test-fw-validate')
  assert.throws(() => r.register('', () => null), /non-empty string/)
  assert.throws(() => r.register(42, () => null), /non-empty string/)
  assert.throws(() => r.register('x', 'not-a-component'), /must be a function/)
})

test('createFieldWidgetRegistry requires a non-empty name', () => {
  assert.throws(() => createFieldWidgetRegistry(''), /non-empty string/)
  assert.throws(() => createFieldWidgetRegistry(), /non-empty string/)
})
