#!/usr/bin/env node
// Contract-level acceptance check for task-003-notifications.
// Runs against a running benchmark app. Usage: BASE_URL=http://localhost:3000 node accept.mjs
// Exit 0 = all checks pass; non-zero = fail.

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

const outboxCount = async () => ((await req('GET', '/api/dev/outbox')).json?.messages || []).length

async function main() {
  console.log(`acceptance: task-003-notifications against ${BASE}`)

  // 1. login
  const login = await req('POST', '/api/login', { email: EMAIL, password: 'password' })
  check('login returns 200', login.status === 200)

  // 2. baseline outbox count
  const before = await outboxCount()
  check('GET /api/dev/outbox returns a messages array', Number.isInteger(before))

  // 3 + 4. creating a note produces exactly one notification
  const a = await req('POST', '/api/notes', { title: 'Note A', body: 'Body A.' })
  check('create A returns 201', a.status === 201)
  const afterOne = await outboxCount()
  check('one note created -> one new outbox message', afterOne === before + 1)

  // 5. the message is addressed to the seeded user
  const messages = (await req('GET', '/api/dev/outbox')).json?.messages || []
  const last = messages[messages.length - 1]
  check('the new message is addressed to the user', last?.to === EMAIL)

  // 6. a second note -> exactly one more message
  const b = await req('POST', '/api/notes', { title: 'Note B', body: 'Body B.' })
  check('create B returns 201', b.status === 201)
  const afterTwo = await outboxCount()
  check('a second note -> exactly one more message', afterTwo === before + 2)

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('acceptance crashed:', err)
  process.exit(2)
})
