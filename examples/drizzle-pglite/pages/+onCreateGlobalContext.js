// Vike's once-per-server hook -- the ONE file that differs from examples/react. Where the
// in-memory twin does `setAdapter(createMemoryAdapter())` and hand-inserts fixed-id rows, this
// opts into the REAL database: it opens the persistent pglite connection, applies migrations, and
// registers the Drizzle adapter via vike-drizzle. Every extension then reads/writes Postgres
// through the same neutral repository -- the admin/auth/rbac code above does not change.
//
// onCreateGlobalContext is isomorphic (it also runs in the browser), so the entire database setup
// sits inside `if (import.meta.env.SSR)` with dynamic imports. Vite replaces that with `false` in
// the client build and drops the branch, keeping pglite's wasm Postgres and node-only bits out of
// the client bundle.
//
// Seeding split by tier (see db/seed.js for the full story):
//   - Tier 1 (tables):        migrations, applied here on boot for dev convenience. Idempotent --
//                             Drizzle's migrator records what it ran, so re-runs are no-ops.
//   - Tier 2 (reference data): roles/permissions/grants via seedRbac (idempotent), so a fresh
//                             clone has a working RBAC model even before `pnpm db:seed`.
//   - Tier 3 (business rows):  NOT here. Sample users come from `pnpm db:seed` or real signups --
//                             never a raw insert on every boot (that is the bug this example fixes).
export default async function onCreateGlobalContext() {
  if (import.meta.env.SSR) {
    const { getAdapter } = await import('@universal-orm/core')
    if (getAdapter()) return // idempotent across dev HMR / double-eval

    const { migrate } = await import('drizzle-orm/pglite/migrator')
    const { registerDrizzle } = await import('vike-drizzle')
    const { seedRbac } = await import('vike-rbac/seed')
    const { openDb, MIGRATIONS_DIR } = await import('../db/connection.js')
    const { appPermissions, standaloneRoles } = await import('../db/permissions.js')

    const { db, schema } = await openDb()
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR }) // Tier 1
    const adapter = registerDrizzle(db, schema)
    await seedRbac(adapter, appPermissions, { roles: standaloneRoles }) // Tier 2
  }
}
