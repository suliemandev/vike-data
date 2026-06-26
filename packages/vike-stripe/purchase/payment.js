// The purchase CORE — framework- and ORM-agnostic. Recording a one-time charge is
// a single `db.payments.insert(...)`: a payment is immutable, so unlike a
// subscription there is nothing to upsert. This is the narrowest universal-orm proof
// — a pure INSERT.
//
// Idempotent on the Stripe payment-intent id: a replayed webhook finds the existing
// row and returns it instead of inserting a duplicate (find + insert, the narrow
// surface; no transaction needed).
//
// `segment` selects WHO the subject is — 'b2b' (organization) or 'b2c' (user) — and
// thus which FK column the row is keyed on.

const SUBJECT_COLUMN = { b2b: 'organization_id', b2c: 'user_id' }

// The one Stripe event type that means money actually moved. The shared webhook hands
// EVERY verified event to the model (once the real SDK is swapped in, a single endpoint
// receives `payment_intent.payment_failed`, refunds, `created`, etc.), so a non-success
// type must not create a payments row that an app reads as proof of payment.
const SUCCESS_TYPE = 'payment_intent.succeeded'

const isoNow = () => new Date().toISOString()

export function createPayments({ db, segment = 'b2b' } = {}) {
  if (!db) throw new Error('[vike-stripe] createPayments requires a universal-orm { db }')
  const subjectColumn = SUBJECT_COLUMN[segment] || SUBJECT_COLUMN.b2b

  return {
    subjectColumn,

    // Record a (Stripe-shaped) successful charge: one INSERT, idempotent per intent.
    async recordCharge(event) {
      // Only a SUCCEEDED charge is a payment. Ignore a failed/refunded/pending charge, or a
      // non-success event type, with a 200 (ignored, not an error) so Stripe does not retry
      // it. A bare event with neither field is treated as a success (back-compat).
      const status = event?.status ?? 'succeeded'
      if ((event?.type && event.type !== SUCCESS_TYPE) || status !== 'succeeded') {
        return { ok: true, ignored: true }
      }

      const intentId = event?.stripePaymentIntentId
      if (!intentId) return { ok: false, error: 'missing-payment-intent' }
      const subjectId = event?.subject
      if (!subjectId) return { ok: false, error: 'missing-subject' }

      const existing = await db.payments.findOne({ stripe_payment_intent_id: intentId })
      if (existing) return { ok: true, payment: existing, idempotent: true }

      const newRow = {
        [subjectColumn]: subjectId,
        amount: event.amount ?? 0,
        currency: event.currency ?? 'usd',
        status: 'succeeded',
        description: event.description ?? null,
        stripe_payment_intent_id: intentId,
        paid_at: event.paidAt ?? isoNow(),
      }
      try {
        const payment = await db.payments.insert(newRow)
        return { ok: true, payment }
      } catch (err) {
        // A concurrent delivery of the same intent won the race and inserted first; the
        // unique constraint on stripe_payment_intent_id is what makes idempotency correct
        // (the find-first above is only a fast path). Re-read and return that row so the
        // webhook stays idempotent (a 200) instead of surfacing the unique-violation 500.
        const row = await db.payments.findOne({ stripe_payment_intent_id: intentId })
        if (row) return { ok: true, payment: row, idempotent: true }
        throw err
      }
    },

    async paymentsFor(subjectId) {
      // Only succeeded charges count. recordCharge already records nothing else, so this is
      // defense in depth against a legacy/failed row reaching an entitlement check.
      return db.payments.find({ [subjectColumn]: subjectId, status: 'succeeded' })
    },
  }
}
