// The vike-notifications server endpoint: a universal middleware (server-agnostic) owning
// the in-app feed routes. Everything is scoped to the signed-in user (resolved from the
// session cookie via vike-auth's server seam), so a client only ever sees / marks its own.
//
//   GET  /notifications        -> { items: feed[], unread: number }
//   POST /notifications/read   body: { ids?: id | id[] }  (omit ids to mark ALL read)
//
// Contributed through the cumulative `middleware` config from +config.js, so it composes
// alongside vike-auth's (and vike-push's) endpoints.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { resolveSessionUser, resolveGuardUser } from 'vike-auth/server'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'
import { getFeed, unreadCount, markRead } from './database-channel.js'

// Resolve the feed owner from the guard the app bound notifications to (VIKE_NOTIFICATIONS_GUARD,
// #279 / #207 P3). Set to a named guard, the in-app feed is read from THAT guard's session cookie +
// subject, so a customer sees the `clients` feed and never the default user's — no cross-talk
// between audiences. Unset / 'default' / an unregistered name falls back to the default-subject
// resolveSessionUser — byte-for-byte today's behaviour. The runtime knob mirrors the build-time
// `notificationsGuard` (schema.js); the app keeps them in sync the way vike-stripe pairs `segment`
// with `BILLING_SEGMENT`.
function resolveFeedUser(request) {
  const name = process.env.VIKE_NOTIFICATIONS_GUARD
  if (!name || name === DEFAULT_GUARD_NAME) return resolveSessionUser(request)
  const guard = getGuard(name)
  return guard ? resolveGuardUser(request, guard) : resolveSessionUser(request)
}

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export function createNotificationsMiddleware() {
  async function notificationsMiddleware(request) {
    const url = new URL(request.url)
    // Own exactly /notifications and /notifications/* — anything else falls through to Vike
    // (so a route like /notifications-archive is NOT captured).
    if (url.pathname !== '/notifications' && !url.pathname.startsWith('/notifications/')) return

    if (url.pathname === '/notifications' && request.method === 'GET') {
      const user = await resolveFeedUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const [items, unread] = await Promise.all([getFeed(user.id), unreadCount(user.id)])
      return json(200, { items, unread })
    }

    if (url.pathname === '/notifications/read' && request.method === 'POST') {
      const user = await resolveFeedUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const body = await readJson(request)
      // omit ids (or send null) to mark everything read; otherwise mark the given id(s).
      const ids = body && body.ids != null ? body.ids : null
      const marked = await markRead(user.id, ids)
      return json(200, { ok: true, marked })
    }

    return json(404, { error: 'unknown-notifications-route' })
  }

  return enhance(notificationsMiddleware, { name: 'vike-notifications', order: MiddlewareOrder.AUTHENTICATION })
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export default createNotificationsMiddleware()
