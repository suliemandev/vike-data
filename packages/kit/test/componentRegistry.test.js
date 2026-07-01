import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createComponentRegistry, createFieldWidgetRegistry } from '../index.js'

test('createComponentRegistry: register / get / tokens round-trip', () => {
  const r = createComponentRegistry('test-blocks', 'react')
  const List = () => null
  assert.equal(r.get('list'), undefined)
  assert.equal(r.register('list', List), List)
  assert.equal(r.get('list'), List)
  assert.ok(r.tokens().includes('list'))
})

test('same (namespace, name) shares one map; different namespace is isolated', () => {
  const a = createComponentRegistry('test-ns-shared', 'react')
  const b = createComponentRegistry('test-ns-shared', 'react')
  const other = createComponentRegistry('test-ns-other', 'react')
  const W = () => null
  a.register('x', W)
  assert.equal(b.get('x'), W) // shared
  assert.equal(other.get('x'), undefined) // isolated by namespace
})

test('createComponentRegistry validates namespace, name, token, component', () => {
  assert.throws(() => createComponentRegistry('', 'react'), /namespace/)
  assert.throws(() => createComponentRegistry('blocks', ''), /name/)
  const r = createComponentRegistry('test-validate', 'react')
  assert.throws(() => r.register('', () => null), /non-empty string/)
  assert.throws(() => r.register('x', 'nope'), /must be a function/)
})

test('a component may be a function (React) OR an object (Vue / memo / forwardRef)', () => {
  const r = createComponentRegistry('test-shapes', 'vue')
  const vueComponent = { props: ['value'], setup: () => () => null } // a Vue component options object
  assert.equal(r.register('list', vueComponent), vueComponent)
  assert.equal(r.get('list'), vueComponent)
  // still rejects a clearly-non-component
  assert.throws(() => r.register('bad', 42), /must be a function or a component object/)
  assert.throws(() => r.register('bad', null), /must be a function or a component object/)
})

test('createFieldWidgetRegistry is a fieldWidgets-namespaced component registry', () => {
  // it shares a slot with the equivalent generic registry (the delegation)
  const fw = createFieldWidgetRegistry('test-delegate')
  const generic = createComponentRegistry('fieldWidgets', 'test-delegate')
  const C = () => null
  fw.register('email', C)
  assert.equal(generic.get('email'), C)
})
