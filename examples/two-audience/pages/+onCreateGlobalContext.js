// Vike's once-per-server hook — where this demo opts into a universal-orm adapter. With
// no real database wired, it registers the in-process MEMORY adapter (a first-class
// adapter: tests, the proof and other extensions run on it) so the auth store's
// users/sessions persist for the life of the dev server, and seeds one user so signing
// in as them reuses the seeded row. A real app swaps this one line for vike-drizzle +
// registerDrizzle(...) pointed at a migrated database; nothing else changes.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

export default async function onCreateGlobalContext() {
  if (getAdapter()) return // idempotent across dev HMR / double-eval
  const adapter = createMemoryAdapter()
  setAdapter(adapter)

  // Seed one user directly through the adapter (schema-less: it just stores rows). Because
  // vike-auth's composed store looks a user up by email before creating one, signing in
  // with the magic link as ada@example.com REUSES this seeded row (same id).
  adapter.insert('users', { id: 'u-ada', email: 'ada@example.com', name: 'Ada Lovelace', active: true, created_at: daysAgo(40), updated_at: daysAgo(2) })
}
