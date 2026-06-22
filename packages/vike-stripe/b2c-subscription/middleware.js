// The b2c-subscription server tier: a universal middleware owning the subscription
// webhook. A thin HTTP shell over the core; the write goes through universal-orm, so
// no ORM is imported here or anywhere in the extension. The event is parsed via the
// shared Stripe SDK (../stripe.js), the single place a real `stripe` package lives.
//
//   POST /stripe/subscription/webhook   subscription event -> db.subscriptions.upsert(...)
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { stripe } from '../stripe.js'

export const SUBSCRIPTION_WEBHOOK_PATH = '/stripe/subscription/webhook'

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Raw handler, exported for testing: `(request) => Response | undefined`. Returns
// undefined for non-matching paths so the request falls through Vike's onion.
export function subscriptionWebhookHandler(subscriptions, { provider = stripe } = {}) {
  const handled = new WeakSet() // idempotency vs duplicate middleware registration

  return async function subscriptionMiddleware(request) {
    const url = new URL(request.url)
    if (url.pathname !== SUBSCRIPTION_WEBHOOK_PATH) return // fall through to Vike
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' })
    if (handled.has(request)) return
    handled.add(request)

    let event
    try {
      event = await provider.webhooks.constructEvent(request)
    } catch {
      return json(400, { ok: false, error: 'invalid-event' })
    }

    const result = await subscriptions.applySubscriptionEvent(event)
    return json(result.ok ? 200 : 400, result)
  }
}

export function createSubscriptionWebhook(subscriptions, opts) {
  return enhance(subscriptionWebhookHandler(subscriptions, opts), {
    name: 'vike-stripe-b2c-subscription',
    order: MiddlewareOrder.AUTHENTICATION,
  })
}
