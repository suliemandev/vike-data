// vike-notifications-stripe — the BRIDGE that turns a billing event into a notification.
//
// Depends on BOTH vike-stripe and vike-notifications; neither of those depends on it
// (AUTHORING section 9 dependency inversion). It subscribes to vike-stripe's subscription
// -event seam and, when a USER subscription transitions into `past_due`, notifies that user
// ("your payment failed") across whichever channels are registered (mail + the in-app
// feed). This is the first real multi-channel consumer that earns the notifications layer
// its place (the issue's discipline: don't build the orchestrator before there is something
// to orchestrate).
//
// Importing this module self-registers the observer; registerStripeBillingNotifications()
// is also exported for explicit or repeat registration (e.g. tests).
import { onSubscriptionEvent } from 'vike-stripe/subscription/events'
import { notify } from 'vike-notifications'

/** The "your payment failed" notification (a plain-object factory). */
export const paymentFailed = (subscription) => ({
  via: () => ['mail', 'database'],
  toMail: () => ({
    subject: 'Your payment failed',
    html: `<p>We couldn't process the payment for your ${subscription?.plan ?? ''} plan. Please update your payment method to avoid interruption.</p>`,
  }),
  toDatabase: () => ({
    type: 'payment_failed',
    data: { title: 'Payment failed', body: `We couldn't process your ${subscription?.plan ?? ''} payment.` },
  }),
})

// React to an applied subscription event. Fire only on the TRANSITION into past_due (not
// every past_due event - a replayed webhook must not re-notify), and only for a USER
// subject: an org (b2b) has no personal inbox, so notifying its members is a separate
// fan-out (out of scope here).
async function onSubscriptionApplied({ subscription, previousStatus, subjectColumn }) {
  if (subjectColumn !== 'user_id') return
  const userId = subscription?.user_id
  if (!userId) return
  if (subscription.status === 'past_due' && previousStatus !== 'past_due') {
    await notify(userId, paymentFailed(subscription))
  }
}

/** Subscribe the billing -> notifications bridge. Returns the unsubscribe function. */
export function registerStripeBillingNotifications() {
  return onSubscriptionEvent(onSubscriptionApplied)
}

// Self-register on import. The observer set dedupes by the stable `onSubscriptionApplied`
// reference, so importing this more than once registers it exactly once.
registerStripeBillingNotifications()

export default registerStripeBillingNotifications
