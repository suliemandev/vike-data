// The b2c-subscription CORE — framework- and ORM-agnostic. It takes a universal-orm
// repository (`db`) and upserts the single `subscriptions` row for a subject. No
// Vike, no HTTP, no ORM: the write is just `db.subscriptions.upsert(...)`.
//
// A subscription webhook is the canonical UPSERT case: the same subject emits
// repeated events (created -> renewed -> plan_changed -> canceled), each converging
// the one row. Keyed by the unique subject FK, a replayed or out-of-order event
// never doubles it. No transaction (a single upsert is atomic).

const SUBJECT_COLUMN = { organization: 'organization_id', user: 'user_id' }

const isoNow = () => new Date().toISOString()

export function createSubscriptions({ db, subject = 'organization' } = {}) {
  if (!db) throw new Error('[vike-stripe] createSubscriptions requires a universal-orm { db }')
  const subjectColumn = SUBJECT_COLUMN[subject] || SUBJECT_COLUMN.organization

  return {
    subjectColumn,

    // Apply a (Stripe-shaped) subscription event: upsert the subject's row.
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

    async subscriptionFor(subjectId) {
      return db.subscriptions.findOne({ [subjectColumn]: subjectId })
    },
  }
}
