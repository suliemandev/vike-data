import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resendTransport } from '../resend.js'
import { sendMail, getOutbox, clearOutbox, setMailTransport, clearMailTransport } from '../index.js'

// A fake fetch that records the call and returns a scripted response. No network.
function fakeFetch(response) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return response
  }
  fn.calls = calls
  return fn
}

// Minimal Response stand-in (the transport only uses ok/status/json/text).
function res({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

test('requires an apiKey at construction', () => {
  assert.throws(() => resendTransport({}), /apiKey string is required/)
  assert.throws(() => resendTransport({ apiKey: '' }), /apiKey string is required/)
})

test('POSTs to the Resend emails endpoint with bearer auth and the message body', async () => {
  const fetch = fakeFetch(res({ body: { id: 'email_123' } }))
  const t = resendTransport({ apiKey: 'rk_test', from: 'Acme <hi@acme.com>', fetch })

  const result = await t.send({ to: 'ada@example.com', subject: 'Hi', html: '<p>yo</p>', text: null, from: null })

  assert.equal(fetch.calls.length, 1)
  const { url, init } = fetch.calls[0]
  assert.equal(url, 'https://api.resend.com/emails')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.authorization, 'Bearer rk_test')
  assert.equal(init.headers['content-type'], 'application/json')
  const sent = JSON.parse(init.body)
  assert.deepEqual(sent, { from: 'Acme <hi@acme.com>', to: 'ada@example.com', subject: 'Hi', html: '<p>yo</p>' })
  // a null text is omitted, not sent as null
  assert.equal('text' in sent, false)
  // returns Resend's id
  assert.deepEqual(result, { id: 'email_123' })
})

test('a per-message from overrides the transport default', async () => {
  const fetch = fakeFetch(res())
  const t = resendTransport({ apiKey: 'rk_test', from: 'default@acme.com', fetch })
  await t.send({ to: 'x@y.z', subject: 'S', from: 'override@acme.com', html: null, text: null })
  assert.equal(JSON.parse(fetch.calls[0].init.body).from, 'override@acme.com')
})

test('throws when neither the transport nor the message has a sender', async () => {
  const fetch = fakeFetch(res())
  const t = resendTransport({ apiKey: 'rk_test', fetch }) // no `from`
  await assert.rejects(
    () => t.send({ to: 'x@y.z', subject: 'S', from: null, html: null, text: null }),
    /no sender/,
  )
  assert.equal(fetch.calls.length, 0) // never hit the network
})

test('throws on a non-2xx, surfacing the status and Resend message (so the queue retries)', async () => {
  const fetch = fakeFetch(res({ ok: false, status: 422, body: { message: 'Invalid `from`' } }))
  const t = resendTransport({ apiKey: 'rk_test', from: 'hi@acme.com', fetch })
  await assert.rejects(
    () => t.send({ to: 'x@y.z', subject: 'S', html: null, text: null, from: null }),
    /Resend responded 422 - Invalid `from`/,
  )
})

test('a non-2xx with an unparseable body still throws with the status', async () => {
  const bad = { ok: false, status: 500, json: async () => { throw new Error('not json') }, text: async () => 'gateway error' }
  const fetch = fakeFetch(bad)
  const t = resendTransport({ apiKey: 'rk_test', from: 'hi@acme.com', fetch })
  await assert.rejects(
    () => t.send({ to: 'x@y.z', subject: 'S', html: null, text: null, from: null }),
    /Resend responded 500 - gateway error/,
  )
})

test('plugs into the vike-mail port: setMailTransport + sendMail delivers through Resend', async () => {
  // Do NOT clearQueue here (it would drop the vike-mail:send job); reset only the transport.
  clearMailTransport()
  clearOutbox()
  const fetch = fakeFetch(res({ body: { id: 'email_999' } }))
  setMailTransport(resendTransport({ apiKey: 'rk_test', from: 'hi@acme.com', fetch }))

  await sendMail({ to: 'ada@example.com', subject: 'Routed via Resend', html: '<p>hi</p>' })

  assert.equal(fetch.calls.length, 1)
  assert.equal(JSON.parse(fetch.calls[0].init.body).subject, 'Routed via Resend')
  assert.equal(getOutbox().length, 0) // the dev outbox was bypassed
  clearMailTransport()
})
