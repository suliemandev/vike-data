#!/usr/bin/env node
// Adversarial correctness gate for task-002-magic-link (methodology v2, issue #359).
//
// accept.mjs checks single-use. This checks the property a hand-roll most often skips: NO
// account-existence oracle. Requesting a magic link for an UNKNOWN email must return the same
// token-shaped 200 as a known one — otherwise the endpoint leaks who has an account (request a
// link for an address, see whether it "works", enumerate users). vike-auth passes for free
// (requestMagicLink issues for any syntactically-valid email; the user is find-or-created at
// redeem). A hand-roll that issues only for known users — a natural shortcut — fails here.
//
// Usage: BASE_URL=http://localhost:3100 node auth-gate.mjs   (exit 0 = pass)

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const KNOWN = 'demo@example.com'
const UNKNOWN = 'no-such-user-9d3f@example.com' // not seeded; must still get a token

let failures = 0
const check = (label, cond) => {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures++
}

async function magicLink(email) {
  const res = await fetch(`${BASE}/api/auth/magic-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON */
  }
  return { status: res.status, token: json?.token }
}

async function main() {
  console.log(`auth-gate: task-002-magic-link against ${BASE}`)

  const known = await magicLink(KNOWN)
  check('known email returns 200', known.status === 200)
  check('known email returns a non-empty token', typeof known.token === 'string' && known.token.length > 0)

  const unknown = await magicLink(UNKNOWN)
  // The no-oracle property: an unknown email is indistinguishable from a known one.
  check('unknown email returns 200 (no existence oracle)', unknown.status === known.status)
  check('unknown email returns a token-shaped response (no existence oracle)',
    typeof unknown.token === 'string' && unknown.token.length > 0)

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('auth-gate crashed:', err)
  process.exit(2)
})
