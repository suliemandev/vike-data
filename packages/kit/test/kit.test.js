import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPort, createOutbox } from '../index.js'

test('createPort: set/get/clear round-trips', () => {
  const port = createPort({ name: 'test.a' })
  assert.equal(port.get(), null) // no value, no default
  port.set({ v: 1 })
  assert.deepEqual(port.get(), { v: 1 })
  port.clear()
  assert.equal(port.get(), null)
})

test('createPort: returns the lazy default when unset, set value wins', () => {
  let built = 0
  const port = createPort({ name: 'test.b', default: () => { built++; return 'DEFAULT' } })
  assert.equal(port.get(), 'DEFAULT')
  assert.equal(port.get(), 'DEFAULT')
  assert.equal(built, 1) // default built once (cached)
  port.set('REAL')
  assert.equal(port.get(), 'REAL') // set value wins over default
  port.clear()
  assert.equal(port.get(), 'DEFAULT')
})

test('createPort: validate throws its own error on set', () => {
  const port = createPort({
    name: 'test.c',
    validate: (v) => { if (!v || typeof v.send !== 'function') throw new Error('setThing: expected a send() method') },
  })
  assert.throws(() => port.set({}), /setThing: expected a send\(\) method/)
  port.set({ send() {} }) // valid, no throw
})

test('createPort: same name shares the same slot', () => {
  const a = createPort({ name: 'test.shared' })
  const b = createPort({ name: 'test.shared' })
  a.set(42)
  assert.equal(b.get(), 42) // b reads what a set (Symbol.for shared)
  a.clear()
})

test('createPort: requires a name', () => {
  assert.throws(() => createPort({}), /non-empty string `name`/)
})

test('createOutbox: record/get/clear', () => {
  const box = createOutbox('test.outbox')
  box.clear()
  assert.deepEqual(box.get(), [])
  box.record({ to: 'a' })
  box.record({ to: 'b' })
  assert.equal(box.get().length, 2)
  assert.equal(box.get()[0].to, 'a')
  box.clear()
  assert.equal(box.get().length, 0)
})
