// Vike's once-per-server hook — where this demo opts into a universal-orm adapter. With
// no real database wired, it registers the in-process MEMORY adapter (a first-class
// adapter: tests, the proof and other extensions run on it) so the admin's reads/writes
// persist for the life of the dev server, and seeds a couple of users so /admin/users has
// rows to show on first load. A real app swaps this one line for vike-drizzle +
// registerDrizzle(...) pointed at a migrated database; the admin code does not change.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

export default function onCreateGlobalContext() {
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

  // RBAC seed (#103): two roles, two `users.*` permissions, and the join rows.
  // Ada is an admin (gets users.view + users.edit); Alan is a member (gets neither).
  // Because vike-auth's composed store looks a user up by email before creating one,
  // signing in as ada@example.com / alan@example.com REUSES these seeded rows (same
  // id), so the logged-in user already carries the role. vike-rbac's oncreate resolves
  // user -> roles -> permissions onto pageContext.user, and the admin resources gate on
  // can()/hasRole below. (Seeding from the cumulative `permissions` registry is a
  // follow-up; here we seed directly, like the users above.)
  const t = { created_at: daysAgo(40), updated_at: daysAgo(40) }
  adapter.insert('roles', { id: 'role-admin', name: 'admin', label: 'Administrator', ...t })
  adapter.insert('roles', { id: 'role-member', name: 'member', label: 'Member', ...t })
  adapter.insert('permissions', { id: 'perm-users-view', name: 'users.view', label: 'View users', ...t })
  adapter.insert('permissions', { id: 'perm-users-edit', name: 'users.edit', label: 'Edit users', ...t })
  adapter.insert('permission_role', { id: 'pr-1', role_id: 'role-admin', permission_id: 'perm-users-view', ...t })
  adapter.insert('permission_role', { id: 'pr-2', role_id: 'role-admin', permission_id: 'perm-users-edit', ...t })
  adapter.insert('role_user', { id: 'ru-ada', role_id: 'role-admin', user_id: 'u-ada', ...t })
  adapter.insert('role_user', { id: 'ru-alan', role_id: 'role-member', user_id: 'u-alan', ...t })
}
