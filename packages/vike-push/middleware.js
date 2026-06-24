// The vike-push server endpoint: a universal middleware (server-agnostic) owning the
// subscription routes. It binds each subscription to the signed-in user (resolved from
// the session cookie via vike-auth's server seam), so a client can only manage its own.
//
//   POST /push/subscribe     body: a PushManager subscription { endpoint, keys }
//   POST /push/unsubscribe   body: { endpoint }
//
// Contributed through the cumulative `middleware` config from +config.js, so it composes
// alongside vike-auth's endpoints.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { resolveSessionUser } from 'vike-auth/server'
import { saveSubscription, removeSubscription } from './index.js'

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export function createPushMiddleware() {
  // Idempotency guard: a universal middleware can be collected once per install path and
  // all copies run even after one returns a Response, so without this the body would be
  // read twice ("Body already read"). Same pattern as vike-auth's middleware.
  const handled = new WeakSet()

  async function pushMiddleware(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/push/')) return // fall through to Vike
    if (handled.has(request)) return
    handled.add(request)

    if (url.pathname === '/push/subscribe' && request.method === 'POST') {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const body = await readJson(request)
      if (!body || !body.endpoint) return json(400, { error: 'invalid-subscription' })
      await saveSubscription(user.id, body)
      return json(200, { ok: true })
    }

    if (url.pathname === '/push/unsubscribe' && request.method === 'POST') {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const body = await readJson(request)
      if (!body || !body.endpoint) return json(400, { error: 'invalid-endpoint' })
      await removeSubscription(body.endpoint)
      return json(200, { ok: true })
    }

    return json(404, { error: 'unknown-push-route' })
  }

  return enhance(pushMiddleware, { name: 'vike-push', order: MiddlewareOrder.AUTHENTICATION })
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export default createPushMiddleware()
