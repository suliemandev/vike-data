// The default billing instance the Vike binding wires up: an in-memory universal-orm
// repository + the billing core. The webhook middleware imports THIS module, so a
// process shares one store.
//
// It builds `db` from the memory adapter over billing's OWN `subscriptions` table —
// enough for the proof to upsert against without a real database. A real app would
// pass a `db` built from `@universal-orm/drizzle` and the app's merged schema
// instead; the billing core is identical either way (that is the whole point).
//
// Cached on globalThis so duplicate module evaluation (pointer imports, dev HMR)
// can't fork the store.
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createBilling } from './billing.js'
import billingSchemas from './schemas.js'

const KEY = Symbol.for('vike-billing.instance')

if (!globalThis[KEY]) {
  const subject = process.env.BILLING_SUBJECT === 'user' ? 'user' : 'organization'
  // Merge just billing's own fragment: the subject FK points at users/organizations
  // (owned by auth/teams), which aren't in this standalone set, so mergeSchemas
  // reports a dangling-reference conflict — harmless here, since createRepository
  // only needs the `subscriptions` table to drive upserts. In the real app, billing
  // is merged with auth + teams and the FK resolves cleanly.
  const { tables } = mergeSchemas(billingSchemas({ billingSubject: subject }))
  const db = createRepository({ tables }, createMemoryAdapter())
  globalThis[KEY] = createBilling({ db, subject })
}

/** @type {ReturnType<typeof import('./billing.js').createBilling>} */
export const billing = globalThis[KEY]
