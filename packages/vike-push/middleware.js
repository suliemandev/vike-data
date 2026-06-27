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
import { getAdapter } from '@universal-orm/core'
import { jsonResponse as json, readJsonSafe as readJson, resolveOwnerId as resolveOwnerIdShared } from '@vike-data/kit'
import { resolveSessionUser } from 'vike-auth/server'
import { resolveSubject } from 'vike-auth/subject'
import { saveSubscription, removeSubscription } from './index.js'

// Resolve the OWNER id a subscription is bound to from the signed-in user (#250), via the shared
// kit contract. By default the owner IS the user (owner id = `user.id`) and push stays single-user;
// when the app binds subscriptions to a different owner (VIKE_PUSH_OWNER_FROM, e.g.
// `current_organization_id`) kit loads the subject row and reads that field, returning null when
// the user has no such owner so the caller answers 403. vike-push has no guard axis, so the subject
// table is always the default subject. Matches the build-time `pushOwner` column the app set.
const resolveOwnerId = (user) =>
  resolveOwnerIdShared(user, {
    from: process.env.VIKE_PUSH_OWNER_FROM,
    subjectTable: resolveSubject().users,
    adapter: getAdapter(),
  })

export function createPushMiddleware() {
  // Vike dedupes identical `middleware` contributions by extension identity
  // (vikejs/vike#3354), so this runs once per request even when several extensions
  // self-install vike-push. No per-request idempotency guard is needed.
  async function pushMiddleware(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/push/')) return // fall through to Vike

    if (url.pathname === '/push/subscribe' && request.method === 'POST') {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const ownerId = await resolveOwnerId(user)
      if (!ownerId) return json(403, { error: 'no-owner' })
      const body = await readJson(request)
      if (!body || !body.endpoint) return json(400, { error: 'invalid-subscription' })
      await saveSubscription(ownerId, body)
      return json(200, { ok: true })
    }

    if (url.pathname === '/push/unsubscribe' && request.method === 'POST') {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const ownerId = await resolveOwnerId(user)
      if (!ownerId) return json(403, { error: 'no-owner' })
      const body = await readJson(request)
      if (!body || !body.endpoint) return json(400, { error: 'invalid-endpoint' })
      // Scope the delete to the owner, so a client can only unsubscribe a subscription its owner
      // owns, never another owner's endpoint. Under the #250 org binding the scope is the org, so
      // any member can unsubscribe the org's endpoint. Always 200 (idempotent, no oracle).
      await removeSubscription(ownerId, body.endpoint)
      return json(200, { ok: true })
    }

    return json(404, { error: 'unknown-push-route' })
  }

  return enhance(pushMiddleware, { name: 'vike-push', order: MiddlewareOrder.AUTHENTICATION })
}

export default createPushMiddleware()
