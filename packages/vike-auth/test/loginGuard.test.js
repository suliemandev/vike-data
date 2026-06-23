// The /login guard: a signed-in visitor is bounced to the app's post-login home
// (`loginRedirect`, default '/'); a signed-out visitor renders the form. The
// redirect is a Vike abort — `throw redirect(url)` — so we catch it and read the
// target off the abort error.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guard } from '../react/loginGuard.js'

// Run the guard and return the redirect target, or null if it rendered (no throw).
const redirectTarget = (pageContext) => {
  try {
    guard(pageContext)
    return null
  } catch (err) {
    if (!err?._isAbortError) throw err
    return err._pageContextAbort?._urlRedirect?.url ?? null
  }
}

test('signed-out: renders the form (no redirect)', () => {
  assert.equal(redirectTarget({ user: null }), null)
})

test('signed-in: redirects to the default home (/)', () => {
  assert.equal(redirectTarget({ user: { id: 'u1' }, config: {} }), '/')
})

test('signed-in: redirects to the app-configured loginRedirect', () => {
  assert.equal(redirectTarget({ user: { id: 'u1' }, config: { loginRedirect: '/admin' } }), '/admin')
})

test('signed-in: missing config falls back to /', () => {
  assert.equal(redirectTarget({ user: { id: 'u1' } }), '/')
})

test('signed-in: ?next= takes precedence over loginRedirect', () => {
  const pc = { user: { id: 'u1' }, config: { loginRedirect: '/home' }, urlParsed: { search: { next: '/admin/users' } } }
  assert.equal(redirectTarget(pc), '/admin/users')
})

test('signed-in: an unsafe ?next= is ignored, falling back to loginRedirect', () => {
  const pc = { user: { id: 'u1' }, config: { loginRedirect: '/home' }, urlParsed: { search: { next: '//evil.com' } } }
  assert.equal(redirectTarget(pc), '/home')
})
