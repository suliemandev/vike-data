// The subscription server tier: a universal middleware owning the subscription
// webhook. A thin HTTP shell over the core; the write goes through universal-orm, so
// no ORM is imported here or anywhere in the extension. The event is verified +
// parsed via the shared Stripe SDK (../stripe.js), the single place a real `stripe`
// package lives: the signature is checked over the RAW body before the upsert, so a
// forged POST is rejected with a 400 and never reaches the database.
//
//   POST /stripe/subscription/webhook   subscription event -> db.subscriptions.upsert(...)
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { createWebhookMiddleware } from '../stripe.js'

export const SUBSCRIPTION_WEBHOOK_PATH = '/stripe/subscription/webhook'

// Raw handler, exported for testing: `(request) => Response | undefined`. The webhook
// plumbing (path match, method check, RAW-body signature verification, idempotency) is
// the shared `createWebhookMiddleware`; this model's only job is the post-verify core
// call — `applySubscriptionEvent`, which UPSERTs the single subscriptions row.
export function subscriptionWebhookHandler(subscriptions, { provider } = {}) {
  return createWebhookMiddleware({
    path: SUBSCRIPTION_WEBHOOK_PATH,
    onEvent: (event) => subscriptions.applySubscriptionEvent(event),
    provider, // undefined falls back to the shared default instance
  })
}

export function createSubscriptionWebhook(subscriptions, opts) {
  return enhance(subscriptionWebhookHandler(subscriptions, opts), {
    name: 'vike-stripe-subscription',
    order: MiddlewareOrder.AUTHENTICATION,
  })
}
