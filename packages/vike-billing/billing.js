// The framework-agnostic, ORM-agnostic billing CORE — and the live answer to the
// universal-orm question: "how does an extension INSERT?"
//
// No Vike, no HTTP, no ORM here. It takes a universal-orm repository (`db`) and
// upserts the single `subscriptions` row for a subject. The webhook binding
// (middleware.js) turns an HTTP request into this one call; the adapter under `db`
// (memory in the proof, `@universal-orm/drizzle` for real) does the actual write.
//
// A Stripe subscription webhook is the canonical upsert case: the SAME subject
// emits repeated events over time (created -> renewed -> plan_changed -> canceled),
// and each must converge the one subscription row. Keyed by the subject FK (UNIQUE),
// that is a single `upsert` — insert the first time, update in place after — so a
// replayed or out-of-order webhook never doubles the row. No transaction needed:
// one upsert is atomic on its own.

const SUBJECT_COLUMN = { organization: 'organization_id', user: 'user_id' }

const isoNow = () => new Date().toISOString()

export function createBilling({ db, subject = 'organization' } = {}) {
  if (!db) throw new Error('[vike-billing] createBilling requires a universal-orm { db }')
  const subjectColumn = SUBJECT_COLUMN[subject] || SUBJECT_COLUMN.organization

  return {
    subjectColumn,

    // Apply a (Stripe-shaped) subscription event: upsert the subject's row to the
    // new plan / status. ORM-agnostic — this is just `db.subscriptions.upsert(...)`.
    async applySubscriptionEvent(event) {
      const subjectId = event?.subject
      if (!subjectId) return { ok: false, error: 'missing-subject' }

      const row = {
        [subjectColumn]: subjectId,
        plan: event.plan ?? 'free',
        status: event.status ?? 'active',
        seats: event.seats ?? 1,
        stripe_customer_id: event.stripeCustomerId ?? null,
        stripe_subscription_id: event.stripeSubscriptionId ?? null,
        current_period_end: event.currentPeriodEnd ?? null,
        updated_at: event.occurredAt ?? isoNow(),
      }
      const subscription = await db.subscriptions.upsert(row, { onConflict: subjectColumn })
      return { ok: true, subscription }
    },

    // Read the current subscription for a subject (handy for the demo / tests).
    async subscriptionFor(subjectId) {
      return db.subscriptions.findOne({ [subjectColumn]: subjectId })
    },
  }
}
