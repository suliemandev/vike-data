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
import { resolveSessionUser } from 'vike-auth/server'
import { resolveSubject } from 'vike-auth/subject'
import { saveSubscription, removeSubscription } from './index.js'

// Resolve the OWNER id a subscription is bound to from the signed-in user (#250). By default the
// owner IS the user, so the owner id is `user.id` and push stays single-user. When the app binds
// subscriptions to a different owner (e.g. an organization) it sets VIKE_PUSH_OWNER_FROM to the
// subject-row field that holds the owner id (e.g. `current_organization_id`); that field lives on
// the full subject row, not the normalized { id, email, name }, so we load the row by id and read
// it. Returns null when the user has no such owner (e.g. belongs to no org) — the caller answers
// 403, never binding a subscription to a missing/blank owner. vike-push has no guard axis, so the
// subject table is always the env-configured default. Matches the build-time `pushOwner` column.
async function resolveOwnerId(user) {
  const from = process.env.VIKE_PUSH_OWNER_FROM
  if (!from || from.trim() === '' || from.trim() === 'id') return user.id
  const adapter = getAdapter()
  if (!adapter) return null
  const row = (await adapter.find(resolveSubject().users, { id: user.id }))[0]
  const ownerId = row?.[from.trim()]
  return ownerId != null && ownerId !== '' ? ownerId : null
}

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

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

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export default createPushMiddleware()
