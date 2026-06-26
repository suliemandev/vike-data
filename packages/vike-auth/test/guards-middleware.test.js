// The guards request tier: the shared handler (handleAuthRequest) bound to a guard's
// cookie + base, and the dispatcher (createGuardsMiddleware) that routes each
// `/<name>-auth/*` request to its guard. Covers acceptance checks 1-3: a guard's login
// sets ONLY that guard's cookie, the guards are independent, and logout is per-guard.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleAuthRequest } from '../middleware.js'
import { createGuardsMiddleware, default as wiredGuardsMiddleware } from '../guards-middleware.js'
import { defineGuard } from '../guards.js'
import { parseCookies } from '../cookie.js'

const admin = defineGuard('admin', { subject: 'Admin', users: 'admins', sessions: 'admin_sessions', loginTokens: 'admin_login_tokens' })
const opts = { auth: admin.instance, cookieName: admin.cookieName, basePath: admin.basePath, dev: true, secure: false }

const post = (path, body) => new Request(`http://localhost${path}`, { method: 'POST', body })
const setCookieOf = (res) => res.headers.get('set-cookie') || ''

// ------------------------------------------------ handler parameterization ----

test('a non-guard path falls through (returns undefined)', async () => {
  assert.equal(await handleAuthRequest(new Request('http://localhost/'), opts), undefined)
  assert.equal(await handleAuthRequest(new Request('http://localhost/auth/request', { method: 'POST' }), opts), undefined)
})

test('signing in through the guard sets ONLY the guard cookie (vike_auth_session__admin)', async () => {
  // Issue a link on the admin guard, then redeem it through the guard handler.
  const { token } = await admin.instance.requestMagicLink('boss@example.com')
  const res = await handleAuthRequest(new Request(`http://localhost/admin-auth/callback?token=${token}`), opts)
  const cookie = setCookieOf(res)
  assert.match(cookie, /^vike_auth_session__admin=/) // the guard's cookie, not the default
  assert.doesNotMatch(cookie, /^vike_auth_session=/)
  // the cookie carries a live session token for the admin guard
  const token2 = parseCookies(cookie)[admin.cookieName]
  assert.ok(token2)
  assert.equal((await admin.instance.authenticate(token2)).user.email, 'boss@example.com')
})

test('logout posts to the guard base and clears the guard cookie (Max-Age=0)', async () => {
  const res = await handleAuthRequest(post('/admin-auth/logout'), opts)
  const cookie = setCookieOf(res)
  assert.match(cookie, /^vike_auth_session__admin=/)
  assert.match(cookie, /Max-Age=0/)
})

// ----------------------------------------------------- dispatcher -------------

test('the dispatcher routes a request to the guard whose base matches', async () => {
  const client = defineGuard('client', { subject: 'Client', users: 'clients', sessions: 'client_sessions', loginTokens: 'client_login_tokens' })
  const mw = createGuardsMiddleware({ dev: true, secure: false })
  // universal-middleware enhance() returns the handler as a callable with metadata attached.
  assert.equal(typeof mw, 'function')

  // Issue + redeem on the CLIENT guard through the dispatcher; the dispatcher must pick the
  // client guard (its base) and set the client cookie, never the admin one.
  const { token } = await client.instance.requestMagicLink('user@example.com')
  const res = await mw(new Request(`http://localhost/client-auth/callback?token=${token}`))
  assert.match(setCookieOf(res), /^vike_auth_session__client=/)
})

test('the dispatcher falls through for a path no guard owns', async () => {
  const mw = createGuardsMiddleware()
  assert.equal(await mw(new Request('http://localhost/some/page')), undefined)
})

test('the wired default export is a middleware', () => {
  assert.equal(typeof wiredGuardsMiddleware, 'function')
})
