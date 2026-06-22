// The default b2b-payment instance: an in-memory universal-orm repository over the
// `payments` table + the payment core, cached on globalThis. Runs on the memory
// adapter for the proof/demo; a real app passes a drizzle-backed `db` unchanged.
import { mergeSchemas } from '@vike-data/universal-schema'
import { createRepository } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createPayments } from './payment.js'
import paymentSchemas from './schemas.js'

const KEY = Symbol.for('vike-stripe.b2b-payment.instance')

if (!globalThis[KEY]) {
  const subject = process.env.BILLING_SUBJECT === 'user' ? 'user' : 'organization'
  const { tables } = mergeSchemas(paymentSchemas({ billingSubject: subject }))
  const db = createRepository({ tables }, createMemoryAdapter())
  globalThis[KEY] = createPayments({ db, subject })
}

/** @type {ReturnType<typeof import('./payment.js').createPayments>} */
export const payments = globalThis[KEY]
