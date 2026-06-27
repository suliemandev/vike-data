// The one place the app constructs its real database connection: an embedded Postgres
// (pglite) persisted to a directory on disk, wrapped in a Drizzle client over the generated
// schema. Shared by the server boot hook (pages/+onCreateGlobalContext.js) and the standalone
// db scripts (db/migrate.js, db/seed.js) so they all speak to the SAME database the same way.
//
// pglite is real Postgres compiled to wasm: zero external service, no server to run, yet it
// persists to `dataDir` so rows survive a restart -- the property the in-memory examples lack.
// One caveat it inherits from being in-process: a single OS process may hold the dataDir at a
// time, so the standalone scripts and `pnpm dev` cannot run against it at once (stop the dev
// server before `pnpm db:seed`). A server-backed Postgres would not have this limit; swapping
// the two lines below for `drizzle(pool)` over node-postgres is the only change.
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '../drizzle/schema.generated.ts'

// Persisted next to the app. `pnpm db:reset` deletes it for a clean slate.
export const DATA_DIR = new URL('../.pgdata', import.meta.url).pathname

// Where drizzle-kit writes the committed SQL migrations (db/migrate.js applies them).
export const MIGRATIONS_DIR = new URL('../drizzle/migrations', import.meta.url).pathname

export { schema }

/** Open the persistent pglite database and a Drizzle client over the generated schema. */
export async function openDb() {
  const client = new PGlite(DATA_DIR)
  await client.waitReady
  const db = drizzle(client)
  return { client, db, schema }
}
