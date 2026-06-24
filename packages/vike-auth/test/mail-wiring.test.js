// The magic link now flows through vike-mail's port (queued via vike-queue) instead
// of a bare console.log. This proves the wiring end to end: POST /auth/request issues
// a link and hands it to whatever mail transport is registered, defaulting to the dev
// outbox when none is.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthMiddleware } from '../middleware.js'
import { auth } from '../instance.js'
import { getOutbox, clearOutbox, setMailTransport, clearMailTransport } from 'vike-mail'

async function postRequest(mw, email) {
  const body = new FormData()
  body.set('email', email)
  return mw(new Request('http://localhost/auth/request', { method: 'POST', body }))
}

test('the magic link is delivered through vike-mail (default dev outbox)', async () => {
  clearMailTransport()
  clearOutbox()
  const mw = createAuthMiddleware(auth, { dev: true })

  const res = await postRequest(mw, 'ada@example.com')
  assert.equal(res.status, 200)

  const out = getOutbox()
  assert.equal(out.length, 1)
  assert.equal(out[0].to, 'ada@example.com')
  assert.equal(out[0].subject, 'Your sign-in link')
  // the email carries the real callback link
  assert.match(out[0].html, /\/auth\/callback\?token=/)
  assert.match(out[0].text, /\/auth\/callback\?token=/)
})

test('a registered transport receives the link instead of the default outbox', async () => {
  clearMailTransport()
  clearOutbox()
  const sent = []
  setMailTransport({ async send(m) { sent.push(m) } })
  const mw = createAuthMiddleware(auth, { dev: false })

  await postRequest(mw, 'alan@example.com')

  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'alan@example.com')
  assert.match(sent[0].html, /\/auth\/callback\?token=/)
  // the default outbox was bypassed
  assert.equal(getOutbox().length, 0)
  clearMailTransport()
})

test('a failing transport does not break /auth/request (no existence leak)', async () => {
  clearMailTransport()
  clearOutbox()
  // The transport throws, but the endpoint must still return the neutral 200 notice:
  // a delivery failure must never reveal whether the address exists. maxAttempts is the
  // sendMail default (3); the swallow is in the middleware, so the request still succeeds.
  setMailTransport({ async send() { throw new Error('transport exploded') } })
  const mw = createAuthMiddleware(auth, { dev: false })

  const res = await postRequest(mw, 'who@example.com')
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.match(body, /Check your inbox/)
  clearMailTransport()
})

test('an invalid email never reaches the mailer', async () => {
  clearMailTransport()
  clearOutbox()
  const mw = createAuthMiddleware(auth, { dev: true })

  const res = await postRequest(mw, 'not-an-email')
  assert.equal(res.status, 400)
  assert.equal(getOutbox().length, 0)
})
