// Vike's once-per-server hook (https://vike.dev/onCreateGlobalContext) — where the
// app opts into a real database. It picks the universal-orm adapter from VIKE_DATA_ORM and
// registers it, so the extensions' webhooks write to a real database instead of the in-memory
// default. The connection is created HERE, at server start (never at config-load), and the
// live objects stay out of Vike's serialized config. Without the env var the app stays on the
// memory adapter and this hook is a no-op.
//
// PGlite (Drizzle) / sqlite :memory: (Rudder) keep the demo zero-setup; a real app points each
// at a migrated database (a Postgres pool, or DATABASE_URL).
import { registerDrizzle } from 'vike-drizzle'
import { registerRudder } from 'vike-rudder'
import { drizzle } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import * as schema from '../drizzle/schema.generated.ts'

export default async function onCreateGlobalContext() {
  const orm = process.env.VIKE_DATA_ORM

  if (orm === 'drizzle') {
    registerDrizzle(drizzle(new PGlite()), schema)
    return
  }

  // Rudder runtime (#75): register @rudderjs/database as the universal-orm adapter via
  // vike-rudder. `NativeAdapter.make({ driver, url })` builds a connection from a URL with no
  // Rudder framework bootstrap — that is what makes it usable from a plain Vike app. (Static
  // import, like the drizzle one above: this hook is server-only, so its DB-driver imports are
  // excluded from the client bundle — a dynamic import would be code-split into a client chunk.)
  if (orm === 'rudder') {
    await registerRudder({ driver: 'sqlite', url: process.env.DATABASE_URL || ':memory:' })
    return
  }
}
