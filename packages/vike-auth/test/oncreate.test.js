// The render-side hook that resolves the session cookie to `pageContext.user`.
// Two halves matter:
//   - SERVER: read the cookie, resolve the live session to a plain user (or null).
//   - CLIENT: do NOTHING. The hook is isomorphic (Vike runs it on hydration and
//     client-side navigation too), but the session cookie is HttpOnly and
//     `pageContext.headers` does not exist client-side. A client run would
//     resolve null and CLOBBER the user that passToClient already delivered,
//     flipping a signed-in page to signed-out right after hydration. Regression
//     guard for that bug: on the client the hook must leave `user` untouched.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import onCreatePageContext from '../oncreate.js'
import { auth } from '../instance.js'
import { SESSION_COOKIE } from '../constants.js'

// Open a real session on the shared singleton store and return its cookie token.
const openSession = async (email) => {
  const { token } = await auth.requestMagicLink(email)
  const res = await auth.redeemMagicLink(token)
  return res.session.token
}

// ----------------------------------------------------------- client guard ----

test('on the client it does NOT touch user (keeps the passToClient value)', async () => {
  const shipped = { id: 'u-1', email: 'ada@example.com', name: 'Ada' }
  const pageContext = { isClientSide: true, user: shipped }
  await onCreatePageContext(pageContext)
  assert.equal(pageContext.user, shipped) // same object, untouched
})

test('on the client it does not invent a user when none was shipped', async () => {
  const pageContext = { isClientSide: true, user: null }
  await onCreatePageContext(pageContext)
  assert.equal(pageContext.user, null)
})

test('on the client it never reads the cookie even if headers somehow exist', async () => {
  const sessionToken = await openSession('client-cookie@example.com')
  // A live cookie is present, but isClientSide must win: user stays as shipped.
  const pageContext = {
    isClientSide: true,
    user: null,
    headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
  }
  await onCreatePageContext(pageContext)
  assert.equal(pageContext.user, null)
})

// ----------------------------------------------------------- server path ----

test('on the server it resolves a live session cookie to a plain user', async () => {
  const sessionToken = await openSession('server-resolve@example.com')
  const pageContext = { headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` } }
  await onCreatePageContext(pageContext)
  assert.equal(pageContext.user.email, 'server-resolve@example.com')
  // serializable plain view only — no session/token fields leak to the client
  assert.deepEqual(Object.keys(pageContext.user).sort(), ['email', 'id', 'name'])
})

test('on the server with no cookie, user is null', async () => {
  const pageContext = { headers: {} }
  await onCreatePageContext(pageContext)
  assert.equal(pageContext.user, null)
})

test('on the server an unknown cookie token resolves to null', async () => {
  const pageContext = { headers: { cookie: `${SESSION_COOKIE}=not-a-real-token` } }
  await onCreatePageContext(pageContext)
  assert.equal(pageContext.user, null)
})
