// The default purchase instance over a universal-orm repository for the `payments`
// table. Like the subscription instance, it routes through the ADAPTER THE APP
// REGISTERED (`setAdapter` in @universal-orm/core), falling back to the in-process
// memory adapter when none is set (zero-config dev/demo/proof). No ORM import here.
//
// Built LAZILY on first use and cached on globalThis, so the app's `setAdapter(...)`
// at server start is in place before the first webhook resolves the repository.
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createPayments } from './payment.js'
import paymentSchemas from './schemas.js'

const KEY = Symbol.for('vike-stripe.purchase.instance')

function build() {
  const segment = process.env.BILLING_SEGMENT === 'b2c' ? 'b2c' : 'b2b'
  const { tables } = mergeSchemas(paymentSchemas({ segment }))
  const adapter = getAdapter() ?? createMemoryAdapter()
  return createPayments({ db: createRepository({ tables }, adapter), segment })
}

function instance() {
  if (!globalThis[KEY]) globalThis[KEY] = build()
  return globalThis[KEY]
}

// A stable proxy the middleware can bind once; the core is built on first property
// access, after the app has chosen its adapter.
/** @type {ReturnType<typeof import('./payment.js').createPayments>} */
export const payments = new Proxy(
  {},
  {
    get: (_t, prop) => instance()[prop],
  },
)

// Re-exported so an app that builds its own repository can construct a payments core directly,
// the same surface the default `payments` proxy exposes.
export { createPayments } from './payment.js'
