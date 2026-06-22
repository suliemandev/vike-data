// The Vike binding's request handler for billing: a universal middleware
// (server-agnostic — Hono / Express / Cloudflare / the Vike dev server alike) that
// owns the Stripe webhook endpoint. It is a thin HTTP shell over the billing core
// (billing.js); the actual write goes through universal-orm, so no ORM is imported
// here or anywhere in the extension.
//
//   POST /stripe/webhook   JSON subscription event -> db.subscriptions.upsert(...)
//
// In the proof the "webhook" is a plain JSON POST (no Stripe signature
// verification — that is a provider concern for a real vike-stripe). The point is
// to watch an extension INSERT/upsert for real, ORM-agnostically.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// The raw handler, exported for testing: `(request) => Response | undefined`.
// Returns undefined for non-billing paths so the request falls through Vike's onion.
export function billingWebhookHandler(billing) {
  // Idempotency guard, same rationale as vike-auth: a self-installed extension has
  // its `middleware` collected once per install path, and universal middlewares all
  // run even after one returns a Response. Without this the second run would re-read
  // the request body ("Body already read"). Handle each request object once.
  const handled = new WeakSet()

  return async function billingMiddleware(request) {
    const url = new URL(request.url)
    if (url.pathname !== '/stripe/webhook') return // fall through to Vike
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' })
    if (handled.has(request)) return
    handled.add(request)

    let event
    try {
      event = await request.json()
    } catch {
      return json(400, { ok: false, error: 'invalid-json' })
    }

    const result = await billing.applySubscriptionEvent(event)
    return json(result.ok ? 200 : 400, result)
  }
}

export function createBillingWebhook(billing) {
  // order = AUTHENTICATION places it in the conventional middleware slot; no `path`
  // so it sees every request and matches /stripe/webhook itself.
  return enhance(billingWebhookHandler(billing), { name: 'vike-billing', order: MiddlewareOrder.AUTHENTICATION })
}
