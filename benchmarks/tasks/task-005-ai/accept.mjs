#!/usr/bin/env node
// Contract-level acceptance check for task-005-ai.
// Runs against a running benchmark app. Usage: BASE_URL=http://localhost:3000 node accept.mjs
// Exit 0 = all checks pass; non-zero = fail.

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = 'demo@example.com'
const QUESTION = 'What is this note about?'

let cookie = ''
let failures = 0

function check(label, cond) {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures++
}

async function req(method, path, body, withCookie = true) {
  const headers = { 'content-type': 'application/json' }
  if (withCookie && cookie) headers.cookie = cookie
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

async function main() {
  console.log(`acceptance: task-005-ai against ${BASE}`)

  // 1. login
  const login = await req('POST', '/api/login', { email: EMAIL, password: 'password' })
  check('login returns 200', login.status === 200)

  // 2. create a note to ask about
  const created = await req('POST', '/api/notes', { title: 'Note A', body: 'Body A about pelicans.' })
  check('create note returns 201', created.status === 201)
  const id = created.json?.note?.id

  // 3. ask -> 200 with a non-empty string answer
  const asked = await req('POST', `/api/notes/${id}/ask`, { question: QUESTION })
  check('ask returns 200', asked.status === 200)
  const answer = asked.json?.answer
  check('answer is a non-empty string', typeof answer === 'string' && answer.length > 0)

  // 4. deterministic: same note + question -> same answer
  const again = await req('POST', `/api/notes/${id}/ask`, { question: QUESTION })
  check('same note + question returns the same answer', again.json?.answer === answer)

  // 5. absent note -> 404
  const missing = await req('POST', '/api/notes/999999/ask', { question: QUESTION })
  check('ask on an absent note returns 404', missing.status === 404)

  // 6. unauthenticated -> 401
  const noAuth = await req('POST', `/api/notes/${id}/ask`, { question: QUESTION }, false)
  check('ask without a session returns 401', noAuth.status === 401)

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures} check(s) failed)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('acceptance crashed:', err)
  process.exit(2)
})
