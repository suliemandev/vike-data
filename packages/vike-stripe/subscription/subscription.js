// The subscription CORE — framework- and ORM-agnostic. It takes a universal-orm
// repository (`db`) and upserts the single `subscriptions` row for a subject. No
// Vike, no HTTP, no ORM: the write is just `db.subscriptions.upsert(...)`.
//
// A subscription webhook is the canonical UPSERT case: the same subject emits
// repeated events (created -> renewed -> plan_changed -> canceled), each converging
// the one row. Keyed by the unique subject FK, a replayed or out-of-order event
// never doubles it. No transaction (a single upsert is atomic).
//
// `segment` selects WHO the subject is — 'b2b' (organization) or 'b2c' (user) — and
// thus which FK column the row is keyed on.
import { emitSubscriptionEvent } from './events.js'

const SUBJECT_COLUMN = { b2b: 'organization_id', b2c: 'user_id' }

const isoNow = () => new Date().toISOString()

export function createSubscriptions({ db, segment = 'b2b' } = {}) {
  if (!db) throw new Error('[vike-stripe] createSubscriptions requires a universal-orm { db }')
  const subjectColumn = SUBJECT_COLUMN[segment] || SUBJECT_COLUMN.b2b

  return {
    subjectColumn,

    // Apply a (Stripe-shaped) subscription event: upsert the subject's row.
    async applySubscriptionEvent(event) {
      const subjectId = event?.subject
      if (!subjectId) return { ok: false, error: 'missing-subject' }

      // The prior row, so observers see a TRANSITION (e.g. into `past_due`), not just the
      // new state. One extra read; the upsert itself is unchanged.
      const previous = await db.subscriptions.findOne({ [subjectColumn]: subjectId })

      // Stripe does not guarantee event ordering and retries deliveries, so a delayed
      // `active` event can arrive AFTER a `canceled` one. Applying it unconditionally would
      // overwrite the newer state and re-grant paid access to a canceled subscriber. When
      // the event carries `occurredAt` and we have a stored timestamp, drop a strictly older
      // event. (No timestamp -> apply, so the existing single-stream upsert is unchanged.)
      const incomingTs = event.occurredAt ? Date.parse(event.occurredAt) : NaN
      const storedTs = previous?.updated_at ? Date.parse(previous.updated_at) : NaN
      if (!Number.isNaN(incomingTs) && !Number.isNaN(storedTs) && incomingTs < storedTs) {
        return { ok: true, subscription: previous, stale: true }
      }

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
      // Notify observers (a bridge can react — e.g. a past_due -> notification — without
      // vike-stripe depending on it). Isolated so an observer can't break the webhook.
      await emitSubscriptionEvent({
        subscription,
        previousStatus: previous?.status ?? null,
        subjectColumn,
        subjectId,
      })
      return { ok: true, subscription }
    },

    async subscriptionFor(subjectId) {
      return db.subscriptions.findOne({ [subjectColumn]: subjectId })
    },

    // Entitlement check for an app's own routes (gate a paid feature). `active` is the only
    // status that grants access; `past_due` / `canceled` / no row do not.
    async isActive(subjectId) {
      const sub = await db.subscriptions.findOne({ [subjectColumn]: subjectId })
      return sub?.status === 'active'
    },
  }
}
