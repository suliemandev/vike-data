// The default subscription instance over a universal-orm repository for the
// `subscriptions` table. It routes through the ADAPTER THE APP REGISTERED
// (`setAdapter` in @universal-orm/core), falling back to the in-process memory
// adapter when none is set (zero-config dev/demo/proof). The app installs the
// adapter once and hands it the connection; this extension never imports an ORM.
//
// Built LAZILY on first use and cached on globalThis (so pointer-import / HMR
// double-eval can't fork the store): the lazy build lets the app's `setAdapter(...)`
// at server start be in place before the first webhook resolves the repository.
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createSubscriptions } from './subscription.js'
import subscriptionSchemas from './schemas.js'

const KEY = Symbol.for('vike-stripe.subscription.instance')

function build() {
  const segment = process.env.BILLING_SEGMENT === 'b2c' ? 'b2c' : 'b2b'
  // The subject FK points at users/organizations (owned by auth/teams), absent from
  // this standalone fragment, so mergeSchemas reports a dangling-reference conflict —
  // harmless, since createRepository only needs the `subscriptions` table. In the
  // real app it merges with auth + teams and the FK resolves.
  const { tables } = mergeSchemas(subscriptionSchemas({ segment }))
  const adapter = getAdapter() ?? createMemoryAdapter()
  return createSubscriptions({ db: createRepository({ tables }, adapter), segment })
}

function instance() {
  if (!globalThis[KEY]) globalThis[KEY] = build()
  return globalThis[KEY]
}

// A stable proxy the middleware can bind once; the core is built on first property
// access, after the app has chosen its adapter.
/** @type {ReturnType<typeof import('./subscription.js').createSubscriptions>} */
export const subscriptions = new Proxy(
  {},
  {
    get: (_t, prop) => instance()[prop],
  },
)
