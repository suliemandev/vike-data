// Subscription domain-event observers — a tiny seam so OTHER extensions can react to a
// subscription change (a failed payment, a cancellation) WITHOUT vike-stripe depending on
// them. Dependency inversion (AUTHORING section 9): vike-stripe EMITS; a bridge that
// depends on both vike-stripe and the consumer (e.g. vike-notifications-stripe) subscribes
// here. vike-stripe core imports nothing of the consumer.
//
// Cached on globalThis so duplicate module evaluation (pointer imports, dev HMR) can't fork
// the observer set.
const KEY = Symbol.for('vike-stripe.subscription.observers')

function observers() {
  return (globalThis[KEY] ??= new Set())
}

/**
 * Observe applied subscription events. The handler receives
 * `{ subscription, previousStatus, subjectColumn, subjectId }` after each apply, so it can
 * detect a TRANSITION (e.g. into `past_due`), not just the new state. Returns an
 * unsubscribe function.
 */
export function onSubscriptionEvent(handler) {
  observers().add(handler)
  return () => observers().delete(handler)
}

/** Drop all observers (tests). */
export function clearSubscriptionObservers() {
  delete globalThis[KEY]
}

/**
 * Emit to every observer, in registration order. An observer error is isolated and logged
 * so a misbehaving consumer can never break the webhook (which must still 200 / persist).
 */
export async function emitSubscriptionEvent(payload) {
  for (const handler of observers()) {
    try {
      await handler(payload)
    } catch (err) {
      console.error('[vike-stripe] a subscription observer threw:', err?.message ?? err)
    }
  }
}
