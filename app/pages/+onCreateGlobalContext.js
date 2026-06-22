// Vike's once-per-server hook (https://vike.dev/onCreateGlobalContext) — where the
// app opts into a real database. With VIKE_DATA_ORM=drizzle it builds a Drizzle
// connection and registers it as the universal-orm adapter via vike-drizzle, so the
// extensions' webhooks write to Postgres instead of the in-memory default. The
// connection is created HERE, at server start (never at config-load), and the live
// objects (connection + generated schema) stay out of Vike's serialized config.
//
// PGlite (in-process Postgres) keeps the demo zero-setup; a real app points this at
// a migrated database (drizzle-orm/node-postgres + a pool). Without the env var the
// app stays on the memory adapter and this hook is a no-op.
import { registerDrizzle } from 'vike-drizzle'
import { drizzle } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import * as schema from '../drizzle/schema.generated.ts'

export default function onCreateGlobalContext() {
  if (process.env.VIKE_DATA_ORM !== 'drizzle') return
  registerDrizzle(drizzle(new PGlite()), schema)
}
