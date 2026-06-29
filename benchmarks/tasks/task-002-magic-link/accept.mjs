#!/usr/bin/env node
// Contract-level acceptance check for task-002-magic-link.
// Runs against a running benchmark app. Usage: BASE_URL=http://localhost:3000 node accept.mjs
// Exit 0 = all checks pass; non-zero = fail.

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = 'demo@example.com'
const PASSWORD = 'password'

let failures = 0

function check(label, cond) {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures++
}

// Each call may carry its own cookie jar, so we can prove the magic-link session stands on
// its own (not a leftover from the password login).
async function req(method, path, body, cookie) {
  const headers = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const setCookie = res.headers.get('set-cookie')
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json, cookie: setCookie ? setCookie.split(';')[0] : '' }
}

async function main() {
  console.log(`acceptance: task-002-magic-link against ${BASE}`)

  // 1. request a magic link -> a token is returned (dev/benchmark affordance)
  const issued = await req('POST', '/api/auth/magic-link', { email: EMAIL })
  check('request magic-link returns 200', issued.status === 200)
  const token = issued.json?.token
  check('request magic-link returns a non-empty token', typeof token === 'string' && token.length > 0)

  // 2. redeem it -> 200 { ok: true } + a session cookie
  const redeemed = await req('POST', '/api/auth/magic-link/redeem', { token })
  check('redeem returns 200', redeemed.status === 200)
  check('redeem sets a session cookie', redeemed.cookie.length > 0)

  // 3. the magic-link session authorizes the app
  const notes = await req('GET', '/api/notes', undefined, redeemed.cookie)
  check('magic-link session can GET /api/notes (200)', notes.status === 200)

  // 4. a bogus token is rejected
  const bogus = await req('POST', '/api/auth/magic-link/redeem', { token: 'bogus-token' })
  check('redeem of a bogus token returns 401', bogus.status === 401)

  // 5. single use: the same valid token cannot be redeemed twice
  const reused = await req('POST', '/api/auth/magic-link/redeem', { token })
  check('redeem of an already-used token returns 401', reused.status === 401)

  // 6. password login still works (the existing contract is intact)
  const pw = await req('POST', '/api/login', { email: EMAIL, password: PASSWORD })
  check('password login still returns 200', pw.status === 200)
  check('password login still sets a session cookie', pw.cookie.length > 0)

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('acceptance crashed:', err)
  process.exit(2)
})
