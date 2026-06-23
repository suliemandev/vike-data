// Locks the Vike config that makes auth work across client-side navigation.
//
// The session cookie is HttpOnly (server-only), so `user` can only be resolved on
// the server. onCreatePageContext is isomorphic by default ({ server, client }),
// which means on client-side navigation Vike runs it on the client — where there
// is no cookie — and `user` comes back null. Pinning its env to server-only forces
// Vike to round-trip to the server on client-side nav (re-resolving `user`), which
// is what keeps useUser() and the /login guard correct after a client-side click.
// If this regresses, signed-in pages flip to signed-out on client-side navigation.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import reactConfig from '../react/+config.js'

test('onCreatePageContext is pinned to server-only (no client run)', () => {
  const env = reactConfig.meta?.onCreatePageContext?.env
  assert.ok(env, 'meta.onCreatePageContext.env must be set')
  assert.equal(env.server, true)
  assert.notEqual(env.client, true) // must NOT run on the client
})

test('the /login page is guarded', () => {
  const login = reactConfig.pages?.find((p) => p.route === '/login')
  assert.ok(login, '/login page must be declared')
  assert.equal(login.guard, 'import:vike-auth/react/loginGuard:guard')
})

test('loginRedirect has a default and is exposed to server + client', () => {
  assert.equal(reactConfig.loginRedirect, '/')
  const env = reactConfig.meta?.loginRedirect?.env
  assert.equal(env.server, true)
  assert.equal(env.client, true) // the guard reads it in both environments
})
