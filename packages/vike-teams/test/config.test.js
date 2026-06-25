// vike-teams is the composition-proof extension: it self-installs vike-auth, contributes
// `organizations` + `memberships` with cross-extension FKs into auth's `users`, and extends
// `users` with a relation cycle. These tests pin both its own contribution and the real
// composition (merging onto auth with zero conflicts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSchemas } from '@vike-data/vike-schema/schema'
import teamsConfig from '../+config.js'
// auth's schema is a COMPUTED contribution (a factory wired as a pointer-import in its
// +config), so resolve it the way vike-schema does at build, by calling the factory,
// rather than reading the unresolved `schemas` pointer string off the config.
import authSchemas from 'vike-auth/schemas'

const fragment = (table, mode = 'create') =>
  teamsConfig.schemas.find((s) => s.table === table && s.mode === mode)
const column = (frag, name) => frag.columns.find((c) => c.name === name)

test('self-installs vike-auth (one extends entry pulls the chain)', () => {
  assert.equal(teamsConfig.name, 'vike-teams')
  assert.deepEqual(teamsConfig.extends, ['import:vike-auth/config:default'])
})

test('contributes organizations + memberships and extends users (in that order)', () => {
  assert.deepEqual(
    teamsConfig.schemas.map((s) => `${s.mode}:${s.table}`),
    ['create:organizations', 'create:memberships', 'extend:users'],
  )
})

test('organizations: unique slug + a RESTRICT owner FK into auth users', () => {
  const orgs = fragment('organizations')
  assert.equal(column(orgs, 'slug').unique, true)
  const owner = column(orgs, 'owner_id')
  assert.deepEqual(owner.references, { table: 'users', column: 'id' })
  assert.equal(owner.onDelete, 'restrict')
})

test('memberships: cascade FKs to organizations and users, role defaults to member', () => {
  const m = fragment('memberships')
  const org = column(m, 'organization_id')
  const usr = column(m, 'user_id')
  assert.deepEqual(org.references, { table: 'organizations', column: 'id' })
  assert.equal(org.onDelete, 'cascade')
  assert.deepEqual(usr.references, { table: 'users', column: 'id' })
  assert.equal(usr.onDelete, 'cascade')
  assert.equal(column(m, 'role').default, 'member')
})

test('extends auth users with a nullable SET NULL FK back to organizations (the relation cycle)', () => {
  const ext = fragment('users', 'extend')
  const col = column(ext, 'current_organization_id')
  assert.equal(col.nullable, true)
  assert.deepEqual(col.references, { table: 'organizations', column: 'id' })
  assert.equal(col.onDelete, 'set null')
})

test('composition proof: teams merges onto auth with zero conflicts (the Stem Vision)', () => {
  const { tables, conflicts } = mergeSchemas([...authSchemas(), ...teamsConfig.schemas])
  assert.deepEqual(conflicts, [])
  const names = tables.map((t) => t.table)
  for (const t of ['users', 'organizations', 'memberships']) {
    assert.ok(names.includes(t), `expected merged tables to include ${t}`)
  }
  // the cross-extension extend landed on auth's users table
  const users = tables.find((t) => t.table === 'users')
  assert.ok(
    users.columns.some((c) => c.name === 'current_organization_id'),
    'teams should have added current_organization_id to auth users',
  )
})
