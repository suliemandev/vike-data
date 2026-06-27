// vike-auth/server: resolve the current user from a request's session cookie,
// OUTSIDE the render lifecycle (a Telefunc RPC handler reuses this). It must read
// the same session onCreatePageContext reads and return the same plain view.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSessionUser, resolveSessionUserFromCookie, resolveGuardUser, resolveGuardedUser, resolveGuardSubjectTable } from '../server.js'
import { auth } from '../instance.js'
import { defineGuard } from '../guards.js'
import { resolveSubject } from '../subject.js'
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

// resolveGuardUser (the named-guards seam, #267 / #207 P3): resolve the user for a SPECIFIC
// guard descriptor — its own cookie + subject — so a downstream extension can bind ownership
// to a non-default audience.
const openGuardSession = async (guard, email) => {
  const { token } = await guard.instance.requestMagicLink(email)
  const { session } = await guard.instance.redeemMagicLink(token)
  return session.token
}

test('resolveGuardUser resolves the user from that guard\'s own cookie', async () => {
  const guard = defineGuard('srv-admin', { table: 'admins' })
  const token = await openGuardSession(guard, 'a@example.com')
  const req = new Request('http://localhost/x', { headers: { cookie: `${guard.cookieName}=${token}` } })
  const user = await resolveGuardUser(req, guard)
  assert.equal(user.email, 'a@example.com')
  // the same serializable plain view, no token leak
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'name'])
})

test('resolveGuardUser does not read a foreign cookie name (no cross-audience talk)', async () => {
  const guard = defineGuard('srv-admin2', { table: 'admins' })
  const token = await openGuardSession(guard, 'b@example.com')
  // present the valid token under the DEFAULT cookie name; the admin guard reads only its own.
  const req = new Request('http://localhost/x', { headers: { cookie: `${SESSION_COOKIE}=${token}` } })
  assert.equal(await resolveGuardUser(req, guard), null)
})

test('resolveGuardUser is null with no guard or no cookie', async () => {
  const guard = defineGuard('srv-admin3', { table: 'admins' })
  assert.equal(await resolveGuardUser(new Request('http://localhost/x'), null), null)
  assert.equal(await resolveGuardUser(new Request('http://localhost/x'), guard), null)
})

// resolveGuardedUser / resolveGuardSubjectTable (the by-NAME seam the owned-row extensions resolve
// through, #278 / #279 / #207 P3): fold the name -> guard -> user/table step the extensions used to
// re-derive identically. They take the guard NAME (the app's already-read env value), keeping
// vike-auth env-free.

test('resolveGuardedUser: empty / "default" name resolves the default session user', async () => {
  const token = await openSession('guarded-default@example.com')
  const req = new Request('http://localhost/x', { headers: { cookie: `${SESSION_COOKIE}=${token}` } })
  assert.equal((await resolveGuardedUser(req, undefined)).email, 'guarded-default@example.com')
  assert.equal((await resolveGuardedUser(req, '')).email, 'guarded-default@example.com')
  assert.equal((await resolveGuardedUser(req, 'default')).email, 'guarded-default@example.com')
})

test('resolveGuardedUser: a named guard reads THAT guard\'s own cookie + subject', async () => {
  const guard = defineGuard('srv-guarded', { table: 'admins' })
  const token = await openGuardSession(guard, 'guarded-admin@example.com')
  const req = new Request('http://localhost/x', { headers: { cookie: `${guard.cookieName}=${token}` } })
  assert.equal((await resolveGuardedUser(req, 'srv-guarded')).email, 'guarded-admin@example.com')
})

test('resolveGuardedUser: an unregistered name falls back to the default session user', async () => {
  const token = await openSession('guarded-fallback@example.com')
  const req = new Request('http://localhost/x', { headers: { cookie: `${SESSION_COOKIE}=${token}` } })
  assert.equal((await resolveGuardedUser(req, 'no-such-guard')).email, 'guarded-fallback@example.com')
})

test('resolveGuardSubjectTable: empty / "default" / unregistered -> the default subject', () => {
  const def = resolveSubject().users
  assert.equal(resolveGuardSubjectTable(undefined), def)
  assert.equal(resolveGuardSubjectTable(''), def)
  assert.equal(resolveGuardSubjectTable('default'), def)
  assert.equal(resolveGuardSubjectTable('no-such-guard'), def)
})

test('resolveGuardSubjectTable: a named guard returns its own subject table', () => {
  const guard = defineGuard('srv-subj', { table: 'admins' })
  assert.equal(resolveGuardSubjectTable('srv-subj'), guard.subject.users)
})
