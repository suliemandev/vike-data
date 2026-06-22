// The b2b-payment CORE — framework- and ORM-agnostic. Recording a one-time charge is
// a single `db.payments.insert(...)`: a payment is immutable, so unlike a
// subscription there is nothing to upsert. This is the narrowest universal-orm proof
// — a pure INSERT.
//
// Idempotent on the Stripe payment-intent id: a replayed webhook finds the existing
// row and returns it instead of inserting a duplicate (find + insert, the narrow
// surface; no transaction needed).

const SUBJECT_COLUMN = { organization: 'organization_id', user: 'user_id' }

const isoNow = () => new Date().toISOString()

export function createPayments({ db, subject = 'organization' } = {}) {
  if (!db) throw new Error('[vike-stripe] createPayments requires a universal-orm { db }')
  const subjectColumn = SUBJECT_COLUMN[subject] || SUBJECT_COLUMN.organization

  return {
    subjectColumn,

    // Record a (Stripe-shaped) successful charge: one INSERT, idempotent per intent.
    async recordCharge(event) {
      const intentId = event?.stripePaymentIntentId
      if (!intentId) return { ok: false, error: 'missing-payment-intent' }
      const subjectId = event?.subject
      if (!subjectId) return { ok: false, error: 'missing-subject' }

      const existing = await db.payments.findOne({ stripe_payment_intent_id: intentId })
      if (existing) return { ok: true, payment: existing, idempotent: true }

      const payment = await db.payments.insert({
        [subjectColumn]: subjectId,
        amount: event.amount ?? 0,
        currency: event.currency ?? 'usd',
        status: event.status ?? 'succeeded',
        description: event.description ?? null,
        stripe_payment_intent_id: intentId,
        paid_at: event.paidAt ?? isoNow(),
      })
      return { ok: true, payment }
    },

    async paymentsFor(subjectId) {
      return db.payments.find({ [subjectColumn]: subjectId })
    },
  }
}
