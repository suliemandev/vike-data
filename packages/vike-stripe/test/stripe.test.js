// The shared Stripe seam: the webhook signature verification that gates every
// billing write. Uses Stripe's real scheme (HMAC-SHA256 over `${t}.${body}`), so a
// header produced by `signWebhook` is exactly what `constructEvent` accepts and an
// attacker without the secret cannot forge one.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { constructEvent, signWebhook, computeSignature, createStripe } from '../stripe.js'

const SECRET = 'whsec_unit'
const body = JSON.stringify({ subject: 'org1', plan: 'pro' })

test('a payload signed with the secret round-trips to the parsed event', () => {
  const event = constructEvent(body, signWebhook(body, SECRET), SECRET)
  assert.deepEqual(event, { subject: 'org1', plan: 'pro' })
})

test('the wrong secret throws (forgery without the key fails)', () => {
  assert.throws(() => constructEvent(body, signWebhook(body, 'nope'), SECRET), /signature verification failed/)
})

test('a missing or malformed header throws', () => {
  assert.throws(() => constructEvent(body, null, SECRET), /missing Stripe-Signature/)
  assert.throws(() => constructEvent(body, 'garbage', SECRET), /malformed/)
  assert.throws(() => constructEvent(body, `t=123`, SECRET), /malformed/) // no v1=
})

test('a missing secret throws (unconfigured deployments reject, not accept)', () => {
  assert.throws(() => constructEvent(body, signWebhook(body, SECRET), undefined), /missing webhook signing secret/)
  assert.throws(() => constructEvent(body, signWebhook(body, SECRET), ''), /missing webhook signing secret/)
})

test('tampering with the body after signing fails verification', () => {
  const header = signWebhook(body, SECRET)
  assert.throws(() => constructEvent(JSON.stringify({ subject: 'org1', plan: 'enterprise' }), header, SECRET), /failed/)
})

test('a stale timestamp is rejected once outside the tolerance window', () => {
  const stale = 1_000_000 // long in the past
  const header = `t=${stale},v1=${computeSignature(body, SECRET, stale)}`
  // Signature is valid, but the timestamp is far outside the window:
  assert.throws(() => constructEvent(body, header, SECRET, { tolerance: 300 }), /tolerance/)
  // Same event verifies when tolerance is disabled (tolerance: 0 skips the clock check):
  assert.deepEqual(constructEvent(body, header, SECRET, { tolerance: 0 }), { subject: 'org1', plan: 'pro' })
  // ...or with an injected clock that places it inside the window:
  assert.deepEqual(constructEvent(body, header, SECRET, { now: () => stale + 10 }), { subject: 'org1', plan: 'pro' })
})

test('multiple v1 signatures verify if any one matches (Stripe rotates secrets)', () => {
  const ts = 1_700_000_000
  const header = `t=${ts},v1=deadbeef,v1=${computeSignature(body, SECRET, ts)}`
  assert.deepEqual(constructEvent(body, header, SECRET, { tolerance: 0 }), { subject: 'org1', plan: 'pro' })
})

test('createStripe binds the configured secret into webhooks.constructEvent', () => {
  const provider = createStripe({ webhookSecret: SECRET })
  const event = provider.webhooks.constructEvent(body, signWebhook(body, SECRET), undefined, { tolerance: 0 })
  assert.deepEqual(event, { subject: 'org1', plan: 'pro' })
  assert.throws(() => provider.webhooks.constructEvent(body, signWebhook(body, 'nope')), /failed/)
})
