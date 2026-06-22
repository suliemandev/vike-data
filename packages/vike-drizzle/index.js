// vike-drizzle — the Drizzle binding for vike-data. It turns the app's Drizzle
// connection into the universal-orm adapter, so every extension (vike-stripe,
// vike-auth, ...) writes to the real database through the neutral repository. The
// app calls registerDrizzle() once, in Vike's onCreateGlobalContext hook:
//
//   // app: +onCreateGlobalContext.js
//   import { registerDrizzle } from 'vike-drizzle'
//   import { drizzle } from 'drizzle-orm/node-postgres'
//   import * as schema from '../drizzle/schema.generated.js'
//   export default () => registerDrizzle(drizzle(pool), schema)
//
// Why a runtime hook and not `extends: [...]`: a live connection can't travel
// through Vike's (serialized, pointer-based) config, and Vike's `extends` only
// accepts module pointer-imports, not a constructed object. The connection is the
// app's at runtime, so the app owns the one-line hook; vike-drizzle is the seam
// between it and @universal-orm/core's adapter registry. Same idea Rom described:
// the app installs ONE adapter and hands it the connection.
import { setAdapter, getAdapter } from '@universal-orm/core'
import { createDrizzleAdapter } from '@universal-orm/drizzle'

export { createDrizzleAdapter }

// Normalize the generated schema to the array form `createDrizzleAdapter` keys by
// the real SQL table name (getTableName). An `import * as schema` namespace is an
// object whose KEYS are export identifiers (e.g. `loginTokens`), which would NOT
// match a multi-word table name (`login_tokens`); its VALUES are the Drizzle tables,
// which carry their SQL name. So always pass the values.
const asTables = (schema) => (Array.isArray(schema) ? schema : Object.values(schema ?? {}))

// Imperative escape hatch: register a Drizzle connection as the runtime adapter.
// Idempotent — the first registration wins (pass { override: true } to replace),
// so duplicate hook evaluation can't fork the adapter.
export function registerDrizzle(db, schema, { override = false } = {}) {
  if (!db) throw new Error('[vike-drizzle] registerDrizzle requires a Drizzle db (e.g. drizzle(pool))')
  const tables = asTables(schema)
  if (!tables.length) throw new Error('[vike-drizzle] registerDrizzle requires the generated Drizzle schema (tables)')
  const existing = getAdapter()
  if (existing && !override) return existing
  const adapter = createDrizzleAdapter(db, tables)
  setAdapter(adapter)
  return adapter
}
