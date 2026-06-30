#!/usr/bin/env node
// Contract-level acceptance check for task-006-push.
// Runs against a running benchmark app. Usage: BASE_URL=http://localhost:3000 node accept.mjs
// Exit 0 = all checks pass; non-zero = fail.

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = 'demo@example.com'
const E1 = 'https://push.example.com/sub/accept-1'
const E2 = 'https://push.example.com/sub/accept-2'

let cookie = ''
let failures = 0

function check(label, cond) {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures++
}

async function req(method, path, body) {
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
    /* non-JSON body */
  }
  return { status: res.status, json }
}

const endpoints = async () =>
  ((await req('GET', '/api/push/subscriptions')).json?.subscriptions || []).map((s) => s.endpoint)

async function main() {
  console.log(`acceptance: task-006-push against ${BASE}`)

  // 1. login
  const login = await req('POST', '/api/login', { email: EMAIL, password: 'password' })
  check('login returns 200', login.status === 200)

  // 2. baseline list
  const before = await endpoints()
  check('GET /api/push/subscriptions returns a subscriptions array', Array.isArray(before))

  // 3. subscribe E1
  const s1 = await req('POST', '/api/push/subscribe', { endpoint: E1 })
  check('subscribe E1 returns 201', s1.status === 201)
  const afterOne = await endpoints()
  check('list now includes E1', afterOne.includes(E1))
  check('subscribe E1 added exactly one', afterOne.length === before.length + 1)

  // 4. subscribe E2
  const s2 = await req('POST', '/api/push/subscribe', { endpoint: E2 })
  check('subscribe E2 returns 201', s2.status === 201)
  const afterTwo = await endpoints()
  check('list now includes E1 and E2', afterTwo.includes(E1) && afterTwo.includes(E2))
  check('subscribe E2 added exactly one', afterTwo.length === before.length + 2)

  // 5. re-subscribe E1 -> no duplicate
  const again = await req('POST', '/api/push/subscribe', { endpoint: E1 })
  check('re-subscribe E1 returns 201', again.status === 201)
  const afterAgain = await endpoints()
  check('re-subscribing E1 does not add a duplicate', afterAgain.length === before.length + 2)

  // 6. unsubscribe E1 (own) -> E1 gone, E2 stays
  const u = await req('POST', '/api/push/unsubscribe', { endpoint: E1 })
  check('unsubscribe E1 returns 200', u.status === 200)
  const afterUnsub = await endpoints()
  check('list no longer includes E1', !afterUnsub.includes(E1))
  check('E2 is still present', afterUnsub.includes(E2))

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('acceptance crashed:', err)
  process.exit(2)
})
