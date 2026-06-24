// The purchase server tier: a universal middleware owning the purchase webhook. A
// thin HTTP shell over the core; the write goes through universal-orm (no ORM
// import). The event is verified + parsed via the shared Stripe SDK (../stripe.js):
// the signature is checked over the RAW body before any write, so a forged POST is
// rejected with a 400 and never reaches the database.
//
//   POST /stripe/purchase/webhook   charge event -> db.payments.insert(...)
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { createWebhookMiddleware } from '../stripe.js'

export const PURCHASE_WEBHOOK_PATH = '/stripe/purchase/webhook'

// Raw handler, exported for testing: `(request) => Response | undefined`. The webhook
// plumbing (path match, method check, RAW-body signature verification, idempotency) is
// the shared `createWebhookMiddleware`; this model's only job is the post-verify core
// call — `recordCharge`, which INSERTs one immutable payments row.
export function purchaseWebhookHandler(payments, { provider } = {}) {
  return createWebhookMiddleware({
    path: PURCHASE_WEBHOOK_PATH,
    onEvent: (event) => payments.recordCharge(event),
    provider, // undefined falls back to the shared default instance
  })
}

export function createPurchaseWebhook(payments, opts) {
  return enhance(purchaseWebhookHandler(payments, opts), {
    name: 'vike-stripe-purchase',
    order: MiddlewareOrder.AUTHENTICATION,
  })
}
