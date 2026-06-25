// The built-in DATABASE channel + the in-app feed read side.
//
// vike-notifications owns the `notifications` table (schema.js, the Stem pattern, like
// vike-auth owns `users`). The database channel persists each delivered notification as a
// feed row; the read helpers (getFeed / unreadCount / markRead) back the bell UI and the
// session-scoped endpoints in middleware.js.
//
// `read_at IS NULL` means unread. The universal-orm filter DSL is equality + `in` ONLY,
// and SQL `= NULL` is never true, so every "unread" predicate is applied IN JS here (not
// pushed into a `{ read_at: null }` filter) — that keeps the SQL adapters correct too.
import { randomUUID } from 'node:crypto'
import { getAdapter } from '@universal-orm/core'

const TABLE = 'notifications'

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error('vike-notifications: no universal-orm adapter registered (call setAdapter() first)')
  }
  return adapter
}

// The built-in in-app channel. `rendered = notification.toDatabase(user)` -> `{ type, data }`.
// `data` is stored as a JSON string (driver-neutral; no JSON column type assumed across ORMs).
export const databaseChannel = {
  name: 'database',
  async send(notifiable, rendered) {
    const adapter = requireAdapter()
    const ts = new Date().toISOString()
    const row = {
      id: randomUUID(),
      user_id: notifiable.id,
      type: rendered?.type ?? 'notification',
      data: JSON.stringify(rendered?.data ?? null),
      read_at: null,
      created_at: ts,
      updated_at: ts,
    }
    await adapter.insert(TABLE, row)
    return { id: row.id }
  },
}

function parseData(raw) {
  try {
    return JSON.parse(raw ?? 'null')
  } catch {
    return null
  }
}

// A stored row -> the feed shape the UI consumes: `data` parsed back from JSON and a
// derived `read` boolean alongside the raw `read_at`.
function toFeedItem(row) {
  return { ...row, data: parseData(row.data), read: row.read_at != null }
}

/** A user's feed, newest first. `limit`/`offset` page it (defaults: 20 from the top). */
export async function getFeed(userId, { limit = 20, offset = 0 } = {}) {
  const adapter = requireAdapter()
  const rows = await adapter.find(
    TABLE,
    { user_id: userId },
    { orderBy: { column: 'created_at', dir: 'desc' }, limit, offset },
  )
  return rows.map(toFeedItem)
}

/** How many of a user's notifications are unread. */
export async function unreadCount(userId) {
  const adapter = requireAdapter()
  const rows = await adapter.find(TABLE, { user_id: userId })
  return rows.reduce((n, r) => n + (r.read_at == null ? 1 : 0), 0)
}

/**
 * Mark a user's notifications read. `ids` = a single id or an array; omit (null) to mark
 * ALL of the user's unread. Scoped to `user_id`, so a client can only ever mark its OWN
 * rows — never another user's, even by guessing an id. Returns the count marked.
 */
export async function markRead(userId, ids = null) {
  const adapter = requireAdapter()
  let targetIds
  if (ids == null) {
    const rows = await adapter.find(TABLE, { user_id: userId })
    targetIds = rows.filter((r) => r.read_at == null).map((r) => r.id)
  } else {
    targetIds = Array.isArray(ids) ? ids : [ids]
  }
  if (!targetIds.length) return 0
  const ts = new Date().toISOString()
  // The owner-scope is the `user_id` in the filter; `{ id: { in } }` is the membership form.
  const updated = await adapter.update(
    TABLE,
    { id: { in: targetIds }, user_id: userId },
    { read_at: ts, updated_at: ts },
  )
  return updated.length
}
