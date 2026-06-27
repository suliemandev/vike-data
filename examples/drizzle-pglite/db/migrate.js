// Tier 1 -- tables. Apply the committed SQL migrations (drizzle-kit generate) to the
// persistent pglite database. Drizzle's migrator records what it has applied in a
// __drizzle_migrations table, so re-running is a no-op: this is safe to run on every deploy,
// and the server boot hook runs the same migrator for dev convenience. Run with `pnpm db:migrate`
// (or `pnpm setup`) while the dev server is stopped.
import { migrate } from 'drizzle-orm/pglite/migrator'
import { openDb, MIGRATIONS_DIR } from './connection.js'

const { client, db } = await openDb()
await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
await client.close()
console.log('[db:migrate] migrations applied (idempotent).')
