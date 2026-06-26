// The subject knob (subject.js): the single source the schema and the store both read
// for which subject + tables vike-auth owns. Defaults reproduce today exactly; an
// override (env, or an explicit arg the schema factory could pass) renames them.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSubject, DEFAULT_SUBJECT } from '../subject.js'

test('with nothing set, resolves to today\'s names byte-for-byte', () => {
  assert.deepEqual(resolveSubject({}, {}), {
    subject: 'User',
    users: 'users',
    sessions: 'sessions',
    loginTokens: 'login_tokens',
    emailColumn: 'email',
    nameColumn: 'name',
    idColumn: 'id',
  })
})

test('the default export is frozen so callers can\'t mutate the shared defaults', () => {
  assert.ok(Object.isFrozen(DEFAULT_SUBJECT))
})

test('env renames the subject + each table independently', () => {
  const env = {
    VIKE_AUTH_SUBJECT: 'Account',
    VIKE_AUTH_USERS_TABLE: 'accounts',
    VIKE_AUTH_SESSIONS_TABLE: 'account_sessions',
    VIKE_AUTH_LOGIN_TOKENS_TABLE: 'account_login_tokens',
  }
  assert.deepEqual(resolveSubject({}, env), {
    subject: 'Account',
    users: 'accounts',
    sessions: 'account_sessions',
    loginTokens: 'account_login_tokens',
    // The contact column is independent of the table rename: unset here, so it stays default.
    emailColumn: 'email',
    nameColumn: 'name',
    idColumn: 'id',
  })
})

test('renaming only the users table leaves sessions/login_tokens at their defaults', () => {
  const r = resolveSubject({}, { VIKE_AUTH_USERS_TABLE: 'accounts' })
  assert.equal(r.users, 'accounts')
  assert.equal(r.sessions, 'sessions')
  assert.equal(r.loginTokens, 'login_tokens')
})

test('an explicit override beats env beats default', () => {
  const env = { VIKE_AUTH_USERS_TABLE: 'from_env' }
  assert.equal(resolveSubject({ users: 'from_override' }, env).users, 'from_override')
  assert.equal(resolveSubject({}, env).users, 'from_env')
  assert.equal(resolveSubject({}, {}).users, 'users')
})

test('blank / whitespace-only values are treated as unset (never a nameless table)', () => {
  // An empty `VIKE_AUTH_USERS_TABLE=` in a .env must not produce a table named ''.
  assert.equal(resolveSubject({}, { VIKE_AUTH_USERS_TABLE: '' }).users, 'users')
  assert.equal(resolveSubject({}, { VIKE_AUTH_USERS_TABLE: '   ' }).users, 'users')
  assert.equal(resolveSubject({ users: '' }, { VIKE_AUTH_USERS_TABLE: 'accounts' }).users, 'accounts')
})

test('values are trimmed', () => {
  assert.equal(resolveSubject({}, { VIKE_AUTH_USERS_TABLE: '  accounts  ' }).users, 'accounts')
})

// --------------------------------------------------- the contact column (P1b) ----

test('the contact column defaults to `email` and is renamed by its own env var', () => {
  assert.equal(resolveSubject({}, {}).emailColumn, 'email')
  assert.equal(resolveSubject({}, { VIKE_AUTH_EMAIL_COLUMN: 'account_email' }).emailColumn, 'account_email')
  // Same precedence + blank-is-unset rules as the table names.
  assert.equal(resolveSubject({ emailColumn: 'override_email' }, { VIKE_AUTH_EMAIL_COLUMN: 'env_email' }).emailColumn, 'override_email')
  assert.equal(resolveSubject({}, { VIKE_AUTH_EMAIL_COLUMN: '   ' }).emailColumn, 'email')
})

test('renaming the table leaves the contact column independent, and vice versa', () => {
  // Each axis moves on its own: a renamed table keeps `email`; a renamed column keeps `users`.
  const r1 = resolveSubject({}, { VIKE_AUTH_USERS_TABLE: 'accounts' })
  assert.equal(r1.emailColumn, 'email')
  const r2 = resolveSubject({}, { VIKE_AUTH_EMAIL_COLUMN: 'account_email' })
  assert.equal(r2.users, 'users')
})

test('nameColumn / idColumn are reserved: they exist with defaults but no env knob (yet)', () => {
  // Shape stability for a future PR — the column map is the single place to grow. They take
  // an explicit override (the factory arg) but are deliberately NOT env-backed, so we never
  // ship a `VIKE_AUTH_*_COLUMN` that silently does nothing.
  assert.equal(resolveSubject({}, {}).nameColumn, 'name')
  assert.equal(resolveSubject({}, {}).idColumn, 'id')
  assert.equal(resolveSubject({}, { VIKE_AUTH_NAME_COLUMN: 'full_name', VIKE_AUTH_ID_COLUMN: 'uid' }).nameColumn, 'name')
  assert.equal(resolveSubject({}, { VIKE_AUTH_ID_COLUMN: 'uid' }).idColumn, 'id')
})
