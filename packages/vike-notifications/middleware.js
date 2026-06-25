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
import { resolveSessionUser } from 'vike-auth/server'
import { getFeed, unreadCount, markRead } from './database-channel.js'

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export function createNotificationsMiddleware() {
  async function notificationsMiddleware(request) {
    const url = new URL(request.url)
    // Own exactly /notifications and /notifications/* — anything else falls through to Vike
    // (so a route like /notifications-archive is NOT captured).
    if (url.pathname !== '/notifications' && !url.pathname.startsWith('/notifications/')) return

    if (url.pathname === '/notifications' && request.method === 'GET') {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const [items, unread] = await Promise.all([getFeed(user.id), unreadCount(user.id)])
      return json(200, { items, unread })
    }

    if (url.pathname === '/notifications/read' && request.method === 'POST') {
      const user = await resolveSessionUser(request)
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
