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
import { getAdapter } from '@universal-orm/core'
import { jsonResponse as json, readJsonSafe as readJson, resolveOwnerId as resolveOwnerIdShared } from '@vike-data/kit'
import { resolveGuardedUser, resolveGuardSubjectTable } from 'vike-auth/server'
import { getFeed, unreadCount, markRead } from './database-channel.js'

// Resolve the signed-in USER for a feed request from the guard the app bound notifications to
// (VIKE_NOTIFICATIONS_GUARD, #279 / #207 P3), via vike-auth's shared by-name seam. Set to a named
// guard, the user is read from THAT guard's session cookie + subject (e.g. `clients`), no cross-talk
// between audiences; unset / 'default' / an unregistered name falls back to the default subject —
// byte-for-byte today's behaviour. This is the AUTH step; the OWNER id is derived from it below
// (they differ only under the #250 owner binding).
const resolveFeedUser = (request) => resolveGuardedUser(request, process.env.VIKE_NOTIFICATIONS_GUARD)

// The subject table the signed-in user lives in (the guard's subject, or the default `users`).
// Used to load the full subject row when the owner id lives on a column other than `.id`.
const userSubjectTable = () => resolveGuardSubjectTable(process.env.VIKE_NOTIFICATIONS_GUARD)

// Resolve the OWNER id whose feed this request reads (#250), via the shared kit contract. By
// default the owner IS the user (owner id = `user.id`) and the feed stays single-user; when the app
// binds the feed to a different owner (VIKE_NOTIFICATIONS_OWNER_FROM, e.g. `current_organization_id`)
// kit loads the subject row and reads that field, returning null when the user has no such owner so
// the caller answers 403. Matches the build-time `notificationsOwner` column the app set.
const resolveOwnerId = (user) =>
  resolveOwnerIdShared(user, {
    from: process.env.VIKE_NOTIFICATIONS_OWNER_FROM,
    subjectTable: userSubjectTable(),
    adapter: getAdapter(),
  })

export function createNotificationsMiddleware() {
  async function notificationsMiddleware(request) {
    const url = new URL(request.url)
    // Own exactly /notifications and /notifications/* — anything else falls through to Vike
    // (so a route like /notifications-archive is NOT captured).
    if (url.pathname !== '/notifications' && !url.pathname.startsWith('/notifications/')) return

    if (url.pathname === '/notifications' && request.method === 'GET') {
      const user = await resolveFeedUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const ownerId = await resolveOwnerId(user)
      if (!ownerId) return json(403, { error: 'no-owner' })
      const [items, unread] = await Promise.all([getFeed(ownerId), unreadCount(ownerId)])
      return json(200, { items, unread })
    }

    if (url.pathname === '/notifications/read' && request.method === 'POST') {
      const user = await resolveFeedUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const ownerId = await resolveOwnerId(user)
      if (!ownerId) return json(403, { error: 'no-owner' })
      const body = await readJson(request)
      // omit ids (or send null) to mark everything read; otherwise mark the given id(s).
      const ids = body && body.ids != null ? body.ids : null
      const marked = await markRead(ownerId, ids)
      return json(200, { ok: true, marked })
    }

    return json(404, { error: 'unknown-notifications-route' })
  }

  return enhance(notificationsMiddleware, { name: 'vike-notifications', order: MiddlewareOrder.AUTHENTICATION })
}

export default createNotificationsMiddleware()
