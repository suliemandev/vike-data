// Tiers 2 + 3 -- reference data and sample rows, the RIGHT way: idempotent and OFF the request
// path. This is the standalone seed a real app runs as a deploy step (`pnpm db:seed`), the
// counterpart to the in-memory examples that hand-insert fixed-id rows on every boot (which
// duplicates / crashes on a real DB). Everything here looks a row up by a stable key and only
// inserts what is missing, so re-running changes nothing.
//
//   Tier 2 (reference data): roles + permissions + grants, derived from the declared
//           permission registry by seedRbac (already idempotent). The app could not function
//           without these, so they are legitimate seed data.
//   Tier 3 (sample/business rows): a couple of demo users so /admin/users has content before
//           anyone signs in. In a real app these come from real signups; here they are an
//           idempotent convenience, NOT raw inserts on boot.
//
// Run while the dev server is stopped (pglite is single-process). `pnpm setup` runs migrate then
// this.
import { registerDrizzle } from 'vike-drizzle'
import { seedRbac, assignRoles } from 'vike-rbac/seed'
import { openDb } from './connection.js'
import { appPermissions, standaloneRoles } from './permissions.js'

const newId = () => globalThis.crypto.randomUUID()
const stamp = () => {
  const at = new Date().toISOString()
  return { created_at: at, updated_at: at }
}

// Find a row by a unique column, else insert it -- the same idempotent primitive seedRbac uses,
// so seeding a business row is safe to re-run and never rewrites an id the FKs depend on.
async function findOrCreate(adapter, table, where, extra = {}) {
  const existing = (await adapter.find(table, where))[0]
  if (existing) return existing
  return adapter.insert(table, { id: newId(), ...where, ...extra, ...stamp() })
}

const { client, db, schema } = await openDb()
const adapter = registerDrizzle(db, schema)

// Tier 2: roles / permissions / grants (idempotent), derived from the shared registry.
await seedRbac(adapter, appPermissions, { roles: standaloneRoles })

// Tier 3: sample users, keyed by email so a re-seed reuses the same row (and signing in with
// the magic link reuses it too, since vike-auth looks a user up by email). Ada is an admin,
// Alan a member, so /admin shows the RBAC split out of the box.
const ada = await findOrCreate(adapter, 'users', { email: 'ada@example.com' }, { name: 'Ada Lovelace', active: true })
const alan = await findOrCreate(adapter, 'users', { email: 'alan@example.com' }, { name: 'Alan Turing', active: true })
await assignRoles(adapter, ada.id, ['admin'])
await assignRoles(adapter, alan.id, ['member'])

await client.close()
console.log('[db:seed] reference data + sample users seeded (idempotent).')
