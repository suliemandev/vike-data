// The guards render hook: resolve each guard's cookie to pageContext.guards[name].user.
// Covers acceptance check 1 (a guard's user resolves from its own cookie; the other stays
// null) and check 5 (no guards declared => the hook is inert, default app unchanged).
//
// NOTE: the no-guards test runs FIRST, before any defineGuard in this file, so it sees a
// genuinely empty registry (node --test runs each file in its own process).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import onCreateGuardsPageContext from '../guards-oncreate.js'
import { defineGuard } from '../guards.js'

// -------------------------------------------------- inert without guards ------

test('no guards declared: the hook leaves pageContext.guards unset (default app unchanged)', async () => {
  const pageContext = { headers: { cookie: 'vike_auth_session=whatever' } }
  await onCreateGuardsPageContext(pageContext)
  assert.equal('guards' in pageContext, false)
})

test('a client-side run bails (HttpOnly cookies only resolve server-side)', async () => {
  const pageContext = { isClientSide: true, headers: {} }
  await onCreateGuardsPageContext(pageContext)
  assert.equal('guards' in pageContext, false)
})

// ------------------------------------------------- per-guard resolution -------

test('resolves only the guard whose cookie is present; the other guard stays null', async () => {
  const admin = defineGuard('admin', { subject: 'Admin', users: 'admins', sessions: 'admin_sessions', loginTokens: 'admin_login_tokens' })
  defineGuard('client', { subject: 'Client', users: 'clients', sessions: 'client_sessions', loginTokens: 'client_login_tokens' })

  // Open a real admin session and present ONLY the admin cookie.
  const { token: link } = await admin.instance.requestMagicLink('boss@example.com')
  const { session } = await admin.instance.redeemMagicLink(link)

  const pageContext = { headers: { cookie: `${admin.cookieName}=${session.token}` } }
  await onCreateGuardsPageContext(pageContext)

  assert.equal(pageContext.guards.admin.user.email, 'boss@example.com')
  assert.equal(pageContext.guards.client.user, null) // signed into admin only -> client is null
  // the exposed view is the plain serializable shape, no token/session leak
  assert.deepEqual(Object.keys(pageContext.guards.admin.user).sort(), ['email', 'id', 'name'])
})

test('both guards can be signed in at once with no cross-talk', async () => {
  const admin = defineGuard('admin', { subject: 'Admin', users: 'admins', sessions: 'admin_sessions', loginTokens: 'admin_login_tokens' })
  const client = defineGuard('client', { subject: 'Client', users: 'clients', sessions: 'client_sessions', loginTokens: 'client_login_tokens' })

  const aLink = (await admin.instance.requestMagicLink('boss@example.com')).token
  const aSession = (await admin.instance.redeemMagicLink(aLink)).session.token
  const cLink = (await client.instance.requestMagicLink('customer@example.com')).token
  const cSession = (await client.instance.redeemMagicLink(cLink)).session.token

  const pageContext = { headers: { cookie: `${admin.cookieName}=${aSession}; ${client.cookieName}=${cSession}` } }
  await onCreateGuardsPageContext(pageContext)

  assert.equal(pageContext.guards.admin.user.email, 'boss@example.com')
  assert.equal(pageContext.guards.client.user.email, 'customer@example.com')
})
