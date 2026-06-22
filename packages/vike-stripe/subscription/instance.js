// The default subscription instance: an in-memory universal-orm repository over the
// `subscriptions` table + the subscription core, cached on globalThis so duplicate
// module evaluation (pointer imports, dev HMR) can't fork the store.
//
// Runs on the memory adapter (no database) for the proof and the demo. A real app
// passes a `db` built from @universal-orm/drizzle and its merged schema; the core is
// unchanged.
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createSubscriptions } from './subscription.js'
import subscriptionSchemas from './schemas.js'

const KEY = Symbol.for('vike-stripe.subscription.instance')

if (!globalThis[KEY]) {
  const segment = process.env.BILLING_SEGMENT === 'b2c' ? 'b2c' : 'b2b'
  // The subject FK points at users/organizations (owned by auth/teams), absent from
  // this standalone fragment, so mergeSchemas reports a dangling-reference conflict —
  // harmless, since createRepository only needs the `subscriptions` table. In the
  // real app it merges with auth + teams and the FK resolves.
  const { tables } = mergeSchemas(subscriptionSchemas({ segment }))
  const db = createRepository({ tables }, createMemoryAdapter())
  globalThis[KEY] = createSubscriptions({ db, segment })
}

/** @type {ReturnType<typeof import('./subscription.js').createSubscriptions>} */
export const subscriptions = globalThis[KEY]
