// vike-auth/server: resolve the current user from a request's session cookie,
// OUTSIDE the render lifecycle (a Telefunc RPC handler reuses this). It must read
// the same session onCreatePageContext reads and return the same plain view.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSessionUser, resolveSessionUserFromCookie } from '../server.js'
import { auth } from '../instance.js'
import { SESSION_COOKIE } from '../constants.js'

// Open a real session on the shared singleton store and return its cookie token.
const openSession = async (email) => {
  const { token } = await auth.requestMagicLink(email)
  const res = await auth.redeemMagicLink(token)
  return res.session.token
}

test('resolveSessionUserFromCookie resolves a live session to a plain user', async () => {
  const token = await openSession('rpc-cookie@example.com')
  const user = await resolveSessionUserFromCookie(`${SESSION_COOKIE}=${token}`)
  assert.equal(user.email, 'rpc-cookie@example.com')
  // serializable plain view only — no session/token fields leak
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'name'])
})

test('resolveSessionUserFromCookie is null with no / unknown cookie', async () => {
  assert.equal(await resolveSessionUserFromCookie(undefined), null)
  assert.equal(await resolveSessionUserFromCookie(''), null)
  assert.equal(await resolveSessionUserFromCookie(`${SESSION_COOKIE}=not-a-real-token`), null)
})

test('resolveSessionUser reads the cookie header off a Web Request', async () => {
  const token = await openSession('rpc-request@example.com')
  const req = new Request('http://localhost/_telefunc', {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  })
  const user = await resolveSessionUser(req)
  assert.equal(user.email, 'rpc-request@example.com')

  const anon = await resolveSessionUser(new Request('http://localhost/_telefunc'))
  assert.equal(anon, null)
})
