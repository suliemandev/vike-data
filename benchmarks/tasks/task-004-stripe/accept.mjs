#!/usr/bin/env node
// Contract-level acceptance check for task-004-stripe.
// Runs against a running benchmark app. Usage: BASE_URL=http://localhost:3000 node accept.mjs
// Exit 0 = all checks pass; non-zero = fail.
//
// Grades the gating + (simulated) billing-event handling: unpaid create is refused (402),
// checkout returns a URL, the dev activation event flips the user to paid, then create works.

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = 'demo@example.com'

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

const noteCount = async () => ((await req('GET', '/api/notes')).json?.notes || []).length

async function main() {
  console.log(`acceptance: task-004-stripe against ${BASE}`)

  // 1. login
  const login = await req('POST', '/api/login', { email: EMAIL, password: 'password' })
  check('login returns 200', login.status === 200)

  // 2 + 3. unpaid create is refused with 402 and leaks no note
  const before = await noteCount()
  const blocked = await req('POST', '/api/notes', { title: 'Gated', body: 'Should be refused.' })
  check('unpaid POST /api/notes returns 402', blocked.status === 402)
  check('refused create added no note', (await noteCount()) === before)

  // 4. checkout returns a URL
  const checkout = await req('POST', '/api/billing/checkout')
  check('POST /api/billing/checkout returns 200', checkout.status === 200)
  check('checkout returns a non-empty url', typeof checkout.json?.url === 'string' && checkout.json.url.length > 0)

  // 5. the simulated billing event flips the user to paid
  const activate = await req('POST', '/api/dev/billing/activate', { email: EMAIL })
  check('POST /api/dev/billing/activate returns 200', activate.status === 200)

  // 6. paid create works and adds exactly one note
  const ok = await req('POST', '/api/notes', { title: 'Paid', body: 'Should succeed.' })
  check('paid POST /api/notes returns 201', ok.status === 201)
  check('paid create added exactly one note', (await noteCount()) === before + 1)

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('acceptance crashed:', err)
  process.exit(2)
})
