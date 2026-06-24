// The purchase server tier: a universal middleware owning the purchase webhook. A
// thin HTTP shell over the core; the write goes through universal-orm (no ORM
// import). The event is verified + parsed via the shared Stripe SDK (../stripe.js):
// the signature is checked over the RAW body before any write, so a forged POST is
// rejected with a 400 and never reaches the database.
//
//   POST /stripe/purchase/webhook   charge event -> db.payments.insert(...)
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { stripe } from '../stripe.js'

export const PURCHASE_WEBHOOK_PATH = '/stripe/purchase/webhook'

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Raw handler, exported for testing: `(request) => Response | undefined`.
export function purchaseWebhookHandler(payments, { provider = stripe } = {}) {
  const handled = new WeakSet()

  return async function purchaseMiddleware(request) {
    const url = new URL(request.url)
    if (url.pathname !== PURCHASE_WEBHOOK_PATH) return // fall through to Vike
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' })
    if (handled.has(request)) return
    handled.add(request)

    let event
    try {
      const rawBody = await request.text()
      const signature = request.headers.get('stripe-signature')
      event = await provider.webhooks.constructEvent(rawBody, signature)
    } catch {
      return json(400, { ok: false, error: 'invalid-signature' })
    }

    const result = await payments.recordCharge(event)
    return json(result.ok ? 200 : 400, result)
  }
}

export function createPurchaseWebhook(payments, opts) {
  return enhance(purchaseWebhookHandler(payments, opts), {
    name: 'vike-stripe-purchase',
    order: MiddlewareOrder.AUTHENTICATION,
  })
}
