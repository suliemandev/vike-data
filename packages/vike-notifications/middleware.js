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
import { resolveSessionUser, resolveGuardUser } from 'vike-auth/server'
import { resolveSubject } from 'vike-auth/subject'
import { getGuard, DEFAULT_GUARD_NAME } from 'vike-auth/guards'
import { getFeed, unreadCount, markRead } from './database-channel.js'

// Resolve the signed-in USER for a feed request from the guard the app bound notifications to
// (VIKE_NOTIFICATIONS_GUARD, #279 / #207 P3). Set to a named guard, the user is read from THAT
// guard's session cookie + subject, so a customer authenticates against `clients` and never the
// default user — no cross-talk between audiences. Unset / 'default' / an unregistered name falls
// back to the default-subject resolveSessionUser — byte-for-byte today's behaviour. This is the
// AUTH step; the OWNER id is derived from it below (they differ only under the #250 owner binding).
function resolveFeedUser(request) {
  const name = process.env.VIKE_NOTIFICATIONS_GUARD
  if (!name || name === DEFAULT_GUARD_NAME) return resolveSessionUser(request)
  const guard = getGuard(name)
  return guard ? resolveGuardUser(request, guard) : resolveSessionUser(request)
}

// The subject table the signed-in user lives in (the guard's subject, or the default `users`).
// Used to load the full subject row when the owner id lives on a column other than `.id`.
function userSubjectTable() {
  const name = process.env.VIKE_NOTIFICATIONS_GUARD
  if (!name || name === DEFAULT_GUARD_NAME) return resolveSubject().users
  const guard = getGuard(name)
  return guard ? guard.subject.users : resolveSubject().users
}

// Resolve the OWNER id whose feed this request reads (#250). By default the owner IS the user, so
// the owner id is `user.id` and the feed stays single-user. When the app binds the feed to a
// different owner (e.g. an organization) it sets VIKE_NOTIFICATIONS_OWNER_FROM to the subject-row
// field that holds the owner id (e.g. `current_organization_id`); that field lives on the full
// subject row, not the normalized { id, email, name }, so we load the row by id and read it.
// Returns null when the user has no such owner (e.g. belongs to no org) — the caller answers 403,
// never reading/marking a feed by a missing/blank owner. Matches the build-time `notificationsOwner`
// column the app set.
async function resolveOwnerId(user) {
  const from = process.env.VIKE_NOTIFICATIONS_OWNER_FROM
  if (!from || from.trim() === '' || from.trim() === 'id') return user.id
  const adapter = getAdapter()
  if (!adapter) return null
  const row = (await adapter.find(userSubjectTable(), { id: user.id }))[0]
  const ownerId = row?.[from.trim()]
  return ownerId != null && ownerId !== '' ? ownerId : null
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

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export default createNotificationsMiddleware()
