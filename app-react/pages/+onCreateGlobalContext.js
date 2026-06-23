// Vike's once-per-server hook — where this demo opts into a universal-orm adapter. With
// no real database wired, it registers the in-process MEMORY adapter (a first-class
// adapter: tests, the proof and other extensions run on it) so the admin's reads/writes
// persist for the life of the dev server, and seeds a couple of users so /admin/users has
// rows to show on first load. A real app swaps this one line for vike-drizzle +
// registerDrizzle(...) pointed at a migrated database; the admin code does not change.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { definePermissions } from 'vike-rbac'
import { seedRbac, assignRoles } from 'vike-rbac/seed'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

// The permissions this app advertises into vike-rbac's cumulative `permissions`
// registry — the same `{ name, label?, roles? }` data an extension would contribute.
// seedRbac() below DERIVES the roles, permissions, and role->permission grants from
// it, so there is one source of truth instead of hand-written join rows. (In a fuller
// app each extension advertises its own set and they compose; here the app declares
// the demo's `users.*` set directly.)
const appPermissions = definePermissions([
  { name: 'users.view', label: 'View users', roles: ['admin'] },
  { name: 'users.edit', label: 'Edit users', roles: ['admin'] },
])

export default async function onCreateGlobalContext() {
  if (getAdapter()) return // idempotent across dev HMR / double-eval
  const adapter = createMemoryAdapter()
  setAdapter(adapter)

  // Seed directly through the adapter (schema-less: it just stores rows), so the list has
  // content before anyone creates a row. The admin form INSERTs add to these.
  adapter.insert('users', { id: 'u-ada', email: 'ada@example.com', name: 'Ada Lovelace', active: true, created_at: daysAgo(40), updated_at: daysAgo(2) })
  adapter.insert('users', { id: 'u-alan', email: 'alan@example.com', name: 'Alan Turing', active: true, created_at: daysAgo(12), updated_at: daysAgo(1) })

  // A session whose user_id references a seeded user, so /admin/sessions shows the FK
  // resolved to the user's email (not a raw uuid) and the create form offers a user picker.
  adapter.insert('sessions', { id: 's-1', user_id: 'u-ada', token: 'sess_demo_ada', created_at: daysAgo(1), updated_at: daysAgo(1) })

  // RBAC seed (#111): materialize the roles/permissions/grants from the `permissions`
  // registry above instead of hand-writing join rows — seedRbac() derives the `admin`
  // role + users.* permissions + their grants from the declared intent. `member` grants
  // no capability, so it isn't in the registry; we pass it as a standalone role so it
  // exists for default-role assignment and hasRole().
  await seedRbac(adapter, appPermissions, { roles: ['member'] })

  // Assign the seeded users their roles. Ada is an admin (gets users.view + users.edit);
  // Alan is a member (gets neither). Because vike-auth's composed store looks a user up
  // by email before creating one, signing in as ada@example.com / alan@example.com REUSES
  // these seeded rows (same id), so the logged-in user already carries the role. A
  // brand-new magic-link signup instead gets the app's `defaultRoles` (['member'], see
  // +config.js) on their first request — the same assignRoles() the resolver calls. The
  // admin resources then gate on can()/hasRole.
  await assignRoles(adapter, 'u-ada', ['admin'])
  await assignRoles(adapter, 'u-alan', ['member'])
}
