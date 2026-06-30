#!/usr/bin/env node
// Adversarial correctness gate for task-004-stripe (methodology v2, issue #359).
//
// v1 graded a dev "activate" endpoint with no signature, so a hand-rolled `paid` flag passed
// and vike-stripe's whole reason to exist (a SIGNED webhook) never ran. This gate grades the
// security property directly: the app must expose a real Stripe-style webhook that
//   - REJECTS an unsigned event and a forged-signature event (and grants no access), and
//   - ACCEPTS a correctly-signed event and flips the subject to paid.
// vike-stripe passes for free (constructEvent verifies); a hand-rolled activate that skips
// signature verification fails the first two checks. Same scheme as Stripe: the `v1` field is
// HMAC-SHA256 over `${timestamp}.${rawBody}`.
//
// Usage: BASE_URL=http://localhost:3100 node webhook-gate.mjs   (exit 0 = pass)

import crypto from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SECRET = process.env.BENCH_STRIPE_WEBHOOK_SECRET || 'whsec_bench_shared_secret'
const WEBHOOK_PATH = '/api/billing/webhook'
const EMAIL = 'demo@example.com'

let cookie = ''
let failures = 0
const check = (label, cond) => {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures++
}

async function req(method, path, body, headers = {}) {
  const h = { 'content-type': 'application/json', ...headers }
  if (cookie) h.cookie = cookie
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json }
}

// A Stripe-Signature header for the exact raw bytes (the real scheme).
const sign = (raw, secret, ts = Math.floor(Date.now() / 1000)) =>
  `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.${raw}`, 'utf8').digest('hex')}`

// Does a note create succeed? (200/201 = paid, 402 = still gated). Probes the live paid state.
async function isPaidNow() {
  const r = await req('POST', '/api/notes', JSON.stringify({ title: 'probe', body: 'probe' }))
  return r.status === 201
}

async function main() {
  console.log(`webhook-gate: task-004-stripe against ${BASE}`)
  await req('POST', '/api/login', JSON.stringify({ email: EMAIL, password: 'password' }))
  check('starts unpaid (note create is gated)', !(await isPaidNow()))

  const event = JSON.stringify({ type: 'checkout.session.completed', data: { email: EMAIL } })

  // 1. unsigned event -> rejected, no access granted
  const unsigned = await req('POST', WEBHOOK_PATH, event)
  check('unsigned webhook is rejected (4xx)', unsigned.status >= 400 && unsigned.status < 500)
  check('unsigned webhook granted no access', !(await isPaidNow()))

  // 2. forged signature -> rejected, no access granted
  const forged = await req('POST', WEBHOOK_PATH, event, { 'stripe-signature': sign(event, 'wrong-secret') })
  check('forged-signature webhook is rejected (4xx)', forged.status >= 400 && forged.status < 500)
  check('forged-signature webhook granted no access', !(await isPaidNow()))

  // 3. correctly-signed event -> accepted, subject flipped to paid
  const signed = await req('POST', WEBHOOK_PATH, event, { 'stripe-signature': sign(event, SECRET) })
  check('correctly-signed webhook is accepted (2xx)', signed.status >= 200 && signed.status < 300)
  check('correctly-signed webhook flips the user to paid', await isPaidNow())

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('webhook-gate crashed:', err)
  process.exit(2)
})
