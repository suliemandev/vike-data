// vike-notifications — the framework-agnostic CLIENT helpers (the browser half of the
// in-app feed). Fetch the signed-in user's feed + unread count, and mark notifications
// read. The React and Vue bells (vike-notifications/react, /vue) are thin wrappers over
// these.
//
// CLIENT-ONLY: imports nothing from the server module (index.js / database-channel.js,
// with node:crypto + the ORM adapter), so it is safe in the client bundle. It only uses
// fetch against the /notifications endpoints (which scope everything to the session user).

/** Load the signed-in user's feed: `{ items, unread }`. */
export async function fetchFeed({ url = '/notifications' } = {}) {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load notifications')
  return res.json()
}

/**
 * Mark notifications read. Pass a single id or an array of ids; omit (null) to mark ALL
 * read. Returns `{ ok, marked }`.
 */
export async function markRead(ids = null, { url = '/notifications/read' } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids == null ? {} : { ids }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to mark notifications read')
  return res.json()
}
