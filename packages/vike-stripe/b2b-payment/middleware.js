// The b2b-payment server tier: a universal middleware owning the payment webhook. A
// thin HTTP shell over the core; the write goes through universal-orm (no ORM
// import). The event is parsed via the shared Stripe SDK (../stripe.js).
//
//   POST /stripe/payment/webhook   charge event -> db.payments.insert(...)
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { stripe } from '../stripe.js'

export const PAYMENT_WEBHOOK_PATH = '/stripe/payment/webhook'

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Raw handler, exported for testing: `(request) => Response | undefined`.
export function paymentWebhookHandler(payments, { provider = stripe } = {}) {
  const handled = new WeakSet()

  return async function paymentMiddleware(request) {
    const url = new URL(request.url)
    if (url.pathname !== PAYMENT_WEBHOOK_PATH) return // fall through to Vike
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' })
    if (handled.has(request)) return
    handled.add(request)

    let event
    try {
      event = await provider.webhooks.constructEvent(request)
    } catch {
      return json(400, { ok: false, error: 'invalid-event' })
    }

    const result = await payments.recordCharge(event)
    return json(result.ok ? 200 : 400, result)
  }
}

export function createPaymentWebhook(payments, opts) {
  return enhance(paymentWebhookHandler(payments, opts), {
    name: 'vike-stripe-b2b-payment',
    order: MiddlewareOrder.AUTHENTICATION,
  })
}
