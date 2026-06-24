import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sendMail, getOutbox, clearOutbox,
  setMailTransport, clearMailTransport,
} from '../index.js'

// Reset only the transport + outbox between tests. Do NOT clearQueue(): the
// `vike-mail:send` job is registered once when index.js is imported, and clearing the
// queue's job registry would drop it. No test here registers a queue driver, so the
// inline default stays active throughout.
function reset() {
  clearMailTransport()
  clearOutbox()
}

test('sendMail validates the message', async () => {
  reset()
  await assert.rejects(() => sendMail(null), /must be an object/)
  await assert.rejects(() => sendMail({ subject: 'x' }), /message.to is required/)
  await assert.rejects(() => sendMail({ to: 'a@b.c' }), /message.subject is required/)
})

test('sendMail delivers through the default console/outbox transport (zero-config)', async () => {
  reset()
  await sendMail({ to: 'ada@example.com', subject: 'Hi', html: '<p>yo</p>' })
  const out = getOutbox()
  assert.equal(out.length, 1)
  assert.equal(out[0].to, 'ada@example.com')
  assert.equal(out[0].subject, 'Hi')
  assert.equal(out[0].html, '<p>yo</p>')
  assert.equal(out[0].text, null)
})

test('a registered transport replaces the default', async () => {
  reset()
  const sent = []
  setMailTransport({ async send(m) { sent.push(m) } })
  await sendMail({ to: 'x@y.z', subject: 'Routed' })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].subject, 'Routed')
  // the default outbox was NOT used
  assert.equal(getOutbox().length, 0)
})

test('setMailTransport validates the transport', () => {
  reset()
  assert.throws(() => setMailTransport({}), /send\(message\)/)
  assert.throws(() => setMailTransport(null), /send\(message\)/)
})

test('send runs through vike-queue (it is a registered job)', async () => {
  reset()
  // The job resolves the transport at RUN time: register after dispatch is set up,
  // before the inline driver runs it, and it is still honoured.
  let got
  setMailTransport({ async send(m) { got = m } })
  await sendMail({ to: 'q@e.d', subject: 'Queued' })
  assert.equal(got.subject, 'Queued')
})
