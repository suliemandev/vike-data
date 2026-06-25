import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDevTransport } from '../index.js'

test('records the mapped entry per send and exposes it via getOutbox', async () => {
  const dev = createDevTransport({
    name: 'test-dev-mail',
    entry: (message) => message,
    line: (message) => `to=${message.to}`,
  })
  await dev.transport.send({ to: 'a@b.c', subject: 'Hi' })
  assert.equal(dev.getOutbox().length, 1)
  assert.deepEqual(dev.getOutbox()[0], { to: 'a@b.c', subject: 'Hi' })
})

test('send is variadic: entry maps multiple args to the recorded shape', async () => {
  const dev = createDevTransport({
    name: 'test-dev-push',
    entry: (subscription, payload) => ({ subscription, payload }),
    line: (subscription) => `endpoint=${subscription.endpoint}`,
  })
  await dev.transport.send({ endpoint: 'https://push/x' }, { title: 'Hi' })
  assert.deepEqual(dev.getOutbox()[0], {
    subscription: { endpoint: 'https://push/x' },
    payload: { title: 'Hi' },
  })
})

test('clearOutbox empties the buffer', async () => {
  const dev = createDevTransport({ name: 'test-dev-clear', entry: (x) => x, line: () => '' })
  await dev.transport.send(1)
  assert.equal(dev.getOutbox().length, 1)
  dev.clearOutbox()
  assert.equal(dev.getOutbox().length, 0)
})

test('two instances with the same name share the outbox (globalThis-keyed)', async () => {
  const a = createDevTransport({ name: 'test-dev-shared', entry: (x) => x, line: () => '' })
  const b = createDevTransport({ name: 'test-dev-shared', entry: (x) => x, line: () => '' })
  await a.transport.send('one')
  assert.deepEqual(b.getOutbox(), ['one'])
})

test('requires a non-empty name (delegated to createOutbox)', () => {
  assert.throws(() => createDevTransport({ entry: (x) => x, line: () => '' }), /non-empty string/)
})
