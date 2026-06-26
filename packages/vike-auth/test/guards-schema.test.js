// Acceptance check 4: the default subject + two guards (admins + clients, each with its own
// sessions + login_tokens) merge into ONE coherent schema with no conflicts, and that merged
// schema compiles to all three ORM targets. This is the same machinery the drift gate
// (vike-schema's `gen:check`) runs — mergeSchemas + the per-ORM generator — so a clean run
// here is the unit-level proof that a two-audience app's tables derive everywhere.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// vike-schema/schema re-exports the framework-agnostic schema core (mergeSchemas +
// generateArtifacts), already a dependency of vike-auth.
import { mergeSchemas, generateArtifacts } from '@vike-data/vike-schema/schema'
import authSchemas from '../schemas.js'
import { defineGuard } from '../guards.js'

const admin = defineGuard('admin', { subject: 'Admin', users: 'admins', sessions: 'admin_sessions', loginTokens: 'admin_login_tokens' })
const client = defineGuard('client', { subject: 'Client', users: 'clients', sessions: 'client_sessions', loginTokens: 'client_login_tokens' })

// The full set an app would contribute: the default subject's tables + each guard's.
const fragments = [...authSchemas(), ...admin.schemas, ...client.schemas]

test('default + admin + client merge with zero conflicts into nine tables', () => {
  const { tables, conflicts } = mergeSchemas(fragments)
  assert.deepEqual(conflicts, [])
  const names = tables.map((t) => t.table).sort()
  assert.deepEqual(names, [
    'admin_login_tokens', 'admin_sessions', 'admins',
    'client_login_tokens', 'client_sessions', 'clients',
    'login_tokens', 'sessions', 'users',
  ])
})

test("each guard's sessions FK targets its OWN users table, not the default", () => {
  const { tables } = mergeSchemas(fragments)
  const fkTarget = (table) => tables.find((t) => t.table === table).columns.find((c) => c.name === 'user_id').references.table
  assert.equal(fkTarget('admin_sessions'), 'admins')
  assert.equal(fkTarget('client_sessions'), 'clients')
  assert.equal(fkTarget('sessions'), 'users')
})

test('the merged two-audience schema compiles to all three ORMs', () => {
  const { tables, conflicts } = mergeSchemas(fragments)
  assert.deepEqual(conflicts, [])
  for (const orm of ['prisma', 'drizzle', 'rudder']) {
    const files = generateArtifacts({ tables, fragments }, orm)
    assert.ok(files.length > 0, `${orm} produced artifacts`)
    // every guard + default table name appears somewhere in the generated output
    const blob = files.map((f) => f.contents).join('\n')
    for (const table of ['admins', 'clients', 'users', 'admin_sessions', 'client_sessions']) {
      assert.ok(blob.includes(table), `${orm} output mentions ${table}`)
    }
  }
})
