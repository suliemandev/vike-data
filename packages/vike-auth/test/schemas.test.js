// vike-auth's computed schema (schemas.js): the same three tables it has always owned,
// with names resolved from the subject knob. Default = byte-for-byte today; an env
// override renames the tables and re-points the FK target (the FK COLUMN stays user_id).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import authSchemas from '../schemas.js'

const tableOf = (frags, name) => frags.find((f) => f.table === name)
const colOf = (frag, name) => frag.columns.find((c) => c.name === name)

// schemas.js reads the rename from env (the single source the runtime store also reads),
// so exercise it by setting env around the call and restoring after.
function withEnv(vars, fn) {
  const saved = {}
  for (const k of Object.keys(vars)) saved[k] = process.env[k]
  Object.assign(process.env, vars)
  try {
    return fn()
  } finally {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

test('default: contributes users / sessions / login_tokens, the FK targets users.id', () => {
  const frags = authSchemas()
  assert.deepEqual(
    frags.map((f) => [f.mode, f.table]),
    [['create', 'users'], ['create', 'sessions'], ['create', 'login_tokens']],
  )
  assert.deepEqual(colOf(tableOf(frags, 'sessions'), 'user_id').references, { table: 'users', column: 'id' })
})

test('the default schema matches the columns the inline schema declared', () => {
  const users = tableOf(authSchemas(), 'users')
  assert.deepEqual(
    users.columns.map((c) => c.name),
    ['id', 'email', 'name', 'password_hash', 'email_verified', 'active', 'created_at', 'updated_at'],
  )
})

test('env renames the tables and re-points the FK target', () => {
  withEnv(
    {
      VIKE_AUTH_USERS_TABLE: 'accounts',
      VIKE_AUTH_SESSIONS_TABLE: 'account_sessions',
      VIKE_AUTH_LOGIN_TOKENS_TABLE: 'account_login_tokens',
    },
    () => {
      const frags = authSchemas()
      assert.deepEqual(
        frags.map((f) => f.table),
        ['accounts', 'account_sessions', 'account_login_tokens'],
      )
      // FK COLUMN is unchanged (still user_id), only its TARGET follows the rename.
      const fk = colOf(tableOf(frags, 'account_sessions'), 'user_id')
      assert.deepEqual(fk.references, { table: 'accounts', column: 'id' })
    },
  )
})

test('renaming only the users table still re-points the sessions FK', () => {
  withEnv({ VIKE_AUTH_USERS_TABLE: 'accounts' }, () => {
    const frags = authSchemas()
    assert.equal(tableOf(frags, 'sessions') !== undefined, true) // sessions keeps its default name
    assert.deepEqual(colOf(tableOf(frags, 'sessions'), 'user_id').references, { table: 'accounts', column: 'id' })
  })
})
