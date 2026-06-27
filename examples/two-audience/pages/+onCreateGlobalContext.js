// Vike's once-per-server hook — where this demo opts into a universal-orm adapter. With no
// real database wired, it registers the in-process MEMORY adapter so the auth stores (the
// default user guard AND the two named guards) persist for the life of the dev server, and
// seeds one row per audience. A real app swaps this one line for vike-drizzle +
// registerDrizzle(...) pointed at a migrated database; nothing else changes.
//
// Importing ../guards.js here REGISTERS the guards in the server process (defineGuard runs
// on import), so the guards middleware + render hook see them. The same module is imported
// by +config.js; defineGuard is idempotent per name, so both paths share one declaration.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { guards } from '../guards.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

export default async function onCreateGlobalContext() {
  // Bind vike-storage's RUNTIME owner resolution to the staff (admin) guard (#278 / #207 P3):
  // the upload endpoint reads this to resolve the uploader from the admin session cookie + the
  // `admins` subject, matching the build-time `storageGuard: 'admin'` in +config.js. Set here
  // (the once-per-server hook, before any request) rather than a .env so the demo is
  // self-contained; a real app would set VIKE_STORAGE_GUARD in its environment. `??=` leaves an
  // explicit env override untouched.
  process.env.VIKE_STORAGE_GUARD ??= 'admin'

  if (getAdapter()) return // idempotent across dev HMR / double-eval
  const adapter = createMemoryAdapter()
  setAdapter(adapter)

  // Seed one row per audience directly through the adapter (schema-less: it just stores
  // rows), into each guard's OWN table. Because the magic-link store looks a subject up by
  // email before creating one, signing in as these addresses REUSES the seeded rows.
  //   - the default user guard's `users` table (the /login + /account flow)
  adapter.insert('users', { id: 'u-ada', email: 'ada@example.com', name: 'Ada Lovelace', active: true, created_at: daysAgo(40), updated_at: daysAgo(2) })
  //   - the staff (admin) guard's `admins` table
  adapter.insert('admins', { id: 'a-boss', email: 'boss@example.com', name: 'Grace Hopper', active: true, created_at: daysAgo(30), updated_at: daysAgo(1) })
  //   - the client guard's `clients` table
  adapter.insert('clients', { id: 'c-1', email: 'customer@example.com', name: 'Margaret Hamilton', active: true, created_at: daysAgo(10), updated_at: daysAgo(1) })

  // Touch `guards` so the import is never tree-shaken (its side effect — registering the
  // guards on import — is the point); harmless otherwise.
  void guards.length
}
