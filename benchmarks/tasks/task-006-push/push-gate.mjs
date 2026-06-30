#!/usr/bin/env node
// Adversarial correctness gate for task-006-push (methodology v2, issue #359).
//
// accept.mjs grades subscribe/list/unsubscribe on ONE user, which a `DELETE WHERE endpoint = ?`
// implementation passes. This checks the property that flow can't see: OWNERSHIP. The unsubscribe
// payload is only `{ endpoint }` and `endpoint` is globally unique, so deleting by endpoint alone is
// the natural hand-roll — and an IDOR: a signed-in user who knows another user's endpoint can
// unsubscribe them (the exact bug class of repo issue #171). The delete (and the list) must be
// scoped to the caller's user_id. vike-push passes for free: removeSubscription(userId, endpoint)
// deletes { endpoint, user_id }. A hand-roll that skips the owner scope fails check 4.
//
// Usage: BASE_URL=http://localhost:3100 node push-gate.mjs   (exit 0 = pass)

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const A = 'demo@example.com'
const B = 'other@example.com'
const EA = 'https://push.example.com/sub/gate-a'
const EB = 'https://push.example.com/sub/gate-b'

let failures = 0
const check = (label, cond) => {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures++
}

// Each session keeps its own cookie jar so A and B don't clobber each other.
function session() {
  let cookie = ''
  return async function req(method, path, body) {
    const headers = { 'content-type': 'application/json' }
    if (cookie) headers.cookie = cookie
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    let json = null
    try {
      json = await res.json()
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json }
  }
}

const endpoints = async (req) =>
  ((await req('GET', '/api/push/subscriptions')).json?.subscriptions || []).map((s) => s.endpoint)

async function main() {
  console.log(`push-gate: task-006-push against ${BASE}`)

  // User B subscribes EB.
  const b = session()
  const loginB = await b('POST', '/api/login', { email: B, password: 'password' })
  check('user B logs in (second seeded user exists)', loginB.status === 200)
  await b('POST', '/api/push/subscribe', { endpoint: EB })
  check("B's list includes EB", (await endpoints(b)).includes(EB))

  // User A subscribes EA.
  const a = session()
  await a('POST', '/api/login', { email: A, password: 'password' })
  await a('POST', '/api/push/subscribe', { endpoint: EA })

  // A attempts to unsubscribe B's endpoint. 200 (idempotent) or 404 are both acceptable responses;
  // the effect is what matters.
  await a('POST', '/api/push/unsubscribe', { endpoint: EB })

  // THE GATE: B's subscription must have survived A's cross-user unsubscribe.
  check("B's EB subscription survives A's cross-user unsubscribe (no IDOR)", (await endpoints(b)).includes(EB))

  // Sanity: A unsubscribing A's OWN endpoint still works, and B is unaffected.
  const ownUnsub = await a('POST', '/api/push/unsubscribe', { endpoint: EA })
  check("A can unsubscribe A's own endpoint (200)", ownUnsub.status === 200)
  check("A's EA is gone after A unsubscribes it", !(await endpoints(a)).includes(EA))
  check("B's EB still present after A's own unsubscribe", (await endpoints(b)).includes(EB))

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('push-gate crashed:', err)
  process.exit(2)
})
