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

test('contributes organizations + memberships + invitations and extends users (in that order)', () => {
  assert.deepEqual(
    teamsConfig.schemas.map((s) => `${s.mode}:${s.table}`),
    ['create:organizations', 'create:memberships', 'create:invitations', 'extend:users'],
  )
})

test('invitations: org FK cascades, invited_by SET NULL into auth users, token unique, status defaults pending', () => {
  const inv = fragment('invitations')
  const org = column(inv, 'organization_id')
  assert.deepEqual(org.references, { table: 'organizations', column: 'id' })
  assert.equal(org.onDelete, 'cascade')
  const invitedBy = column(inv, 'invited_by')
  assert.deepEqual(invitedBy.references, { table: 'users', column: 'id' })
  assert.equal(invitedBy.onDelete, 'set null')
  assert.equal(invitedBy.nullable, true)
  assert.equal(column(inv, 'token').unique, true)
  assert.equal(column(inv, 'status').default, 'pending')
  assert.equal(column(inv, 'role').default, 'member')
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

test('follows a renamed auth subject (VIKE_AUTH_SUBJECT_TABLE) in every FK into it', async () => {
  // The static `teamsConfig` import above was evaluated with the default env, so
  // re-evaluate +config.js with the subject renamed. A query string makes Node ESM
  // treat it as a distinct module and re-run the resolveSubject() call at its top.
  const prev = process.env.VIKE_AUTH_SUBJECT_TABLE
  process.env.VIKE_AUTH_SUBJECT_TABLE = 'accounts'
  try {
    const { default: renamed } = await import('../+config.js?subject=accounts')
    const frag = (table, mode = 'create') =>
      renamed.schemas.find((s) => s.table === table && s.mode === mode)
    const col = (f, name) => f.columns.find((c) => c.name === name)

    // organizations.owner_id and memberships.user_id now target the renamed table...
    assert.deepEqual(col(frag('organizations'), 'owner_id').references, { table: 'accounts', column: 'id' })
    assert.deepEqual(col(frag('memberships'), 'user_id').references, { table: 'accounts', column: 'id' })
    // ...and the cross-extension extend lands on the renamed table, not 'users'.
    assert.ok(frag('accounts', 'extend'), 'extendSchema target should follow the rename')
    assert.equal(frag('users', 'extend'), undefined, 'no extend against the old literal name')

    // And it still merges cleanly onto a renamed auth schema (the factory follows the same env).
    const { tables, conflicts } = mergeSchemas([...authSchemas(), ...renamed.schemas])
    assert.deepEqual(conflicts, [])
    assert.ok(tables.some((t) => t.table === 'accounts'), 'merged tables include the renamed subject')
  } finally {
    if (prev === undefined) delete process.env.VIKE_AUTH_SUBJECT_TABLE
    else process.env.VIKE_AUTH_SUBJECT_TABLE = prev
  }
})

test('resolveTeamSubject: defaults are today\'s names; overrides + env win in that order', async () => {
  const { resolveTeamSubject, DEFAULT_TEAM_SUBJECT } = await import('../subject.js')
  // Default (no env, no override) is byte-for-byte today.
  const def = resolveTeamSubject({}, {})
  assert.equal(def.organizations, 'organizations')
  assert.equal(def.memberships, 'memberships')
  assert.equal(def.team, 'Organization')
  assert.deepEqual(DEFAULT_TEAM_SUBJECT.organizations, 'organizations')
  // env renames the tables; a blank env value is treated as unset.
  assert.equal(resolveTeamSubject({}, { VIKE_TEAMS_ORGANIZATIONS_TABLE: 'teams' }).organizations, 'teams')
  assert.equal(resolveTeamSubject({}, { VIKE_TEAMS_ORGANIZATIONS_TABLE: '   ' }).organizations, 'organizations')
  // explicit override beats env.
  assert.equal(
    resolveTeamSubject({ memberships: 'team_members' }, { VIKE_TEAMS_MEMBERSHIPS_TABLE: 'x' }).memberships,
    'team_members',
  )
  // column map is reserved (default-only), never env-backed.
  assert.equal(resolveTeamSubject({}, { VIKE_TEAMS_SLUG_COLUMN: 'handle' }).slugColumn, 'slug')
})

test('renames its OWN tables (VIKE_TEAMS_*_TABLE) across schema + internal FKs', async () => {
  const prevO = process.env.VIKE_TEAMS_ORGANIZATIONS_TABLE
  const prevM = process.env.VIKE_TEAMS_MEMBERSHIPS_TABLE
  process.env.VIKE_TEAMS_ORGANIZATIONS_TABLE = 'teams'
  process.env.VIKE_TEAMS_MEMBERSHIPS_TABLE = 'team_members'
  try {
    const { default: renamed } = await import('../+config.js?teams=1')
    assert.deepEqual(
      renamed.schemas.map((s) => `${s.mode}:${s.table}`),
      ['create:teams', 'create:team_members', 'create:invitations', 'extend:users'],
    )
    const frag = (table, mode = 'create') => renamed.schemas.find((s) => s.table === table && s.mode === mode)
    const col = (f, name) => f.columns.find((c) => c.name === name)
    // the membership -> org FK and the users.current_organization_id FK follow the new org name.
    assert.deepEqual(col(frag('team_members'), 'organization_id').references, { table: 'teams', column: 'id' })
    assert.deepEqual(col(frag('users', 'extend'), 'current_organization_id').references, { table: 'teams', column: 'id' })
    // FKs into auth's subject are unaffected (still 'users' under default auth env).
    assert.deepEqual(col(frag('teams'), 'owner_id').references, { table: 'users', column: 'id' })
    // and it still merges cleanly onto auth.
    const { conflicts } = mergeSchemas([...authSchemas(), ...renamed.schemas])
    assert.deepEqual(conflicts, [])
  } finally {
    if (prevO === undefined) delete process.env.VIKE_TEAMS_ORGANIZATIONS_TABLE
    else process.env.VIKE_TEAMS_ORGANIZATIONS_TABLE = prevO
    if (prevM === undefined) delete process.env.VIKE_TEAMS_MEMBERSHIPS_TABLE
    else process.env.VIKE_TEAMS_MEMBERSHIPS_TABLE = prevM
  }
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
