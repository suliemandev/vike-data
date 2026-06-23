// The agent API (#113 read, #115 write): the admin's data as machine-readable JSON, for an
// AI agent (or any HTTP client) acting on a user's behalf.
//
//   GET    /admin.json                 the resources the caller may view (the dashboard)
//   GET    /admin/<table>.json?query=  a resource list (filter/orderBy/limit/offset)
//   POST   /admin/<table>.json         create a row            -> 201 + the created row
//   PATCH  /admin/<table>/<id>.json    update a row by its pk  -> 200 + the updated row
//   DELETE /admin/<table>/<id>.json    delete a row by its pk  -> 200 { deleted: true }
//
// THE KEY IDEA (same as the read tier): it is not a second surface with its own auth and
// logic. The middleware maps the `.json` URL to its admin page route and RENDERS it through
// Vike (`renderPage`): vike-auth resolves the user, vike-rbac enriches roles/permissions,
// the page guard runs, and the page's own data hook (dashboardData / listData / newData /
// editData) runs — the same `scope(user)` AND-merge, `canView`/`canEdit` allow-list,
// validated `?query=`, ownership-forcing and universal-orm writes the browser UI goes
// through. We return that hook's result (`pageContext.data`) as JSON instead of HTML, so the
// API inherits the UI's security model by construction and the two can never drift.
//
// For writes the middleware parses the JSON body and hands it to the page's write hook via a
// `pageContext.adminApiWrite` marker (the hook then runs its existing insert/update/delete);
// it never writes to the database itself.
//
// Why a universal middleware and not a Vike page: a page render is always served as
// text/html, so it cannot emit clean `application/json` — a universal middleware owns its
// Response. (Same reason vike-auth serves /auth/* from a middleware.)
//
// Auth is the session cookie the page pipeline already reads; API tokens for headless agents
// are a separate follow-up.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { renderPage } from 'vike/server'

// Map a GET `/admin*.json` path to the admin PAGE route it mirrors, or null when it isn't a
// readable admin JSON endpoint (so the request falls through to Vike untouched).
//   /admin.json          -> /admin           (dashboard)
//   /admin/<table>.json  -> /admin/<table>   (list)
export function pageRouteFor(pathname) {
  if (pathname === '/admin.json') return '/admin'
  const m = pathname.match(/^\/admin\/([^/]+)\.json$/)
  return m ? `/admin/${m[1]}` : null
}

// Map a write request (method + `/admin*.json` path) to the page route that performs it and
// the action to hand the hook, or null when it isn't a valid write endpoint.
//   POST   /admin/<table>.json      -> { /admin/<table>/new, create }
//   PATCH  /admin/<table>/<id>.json -> { /admin/<table>/<id>, update }
//   DELETE /admin/<table>/<id>.json -> { /admin/<table>/<id>, delete }
export function writeTargetFor(pathname, method) {
  const list = pathname.match(/^\/admin\/([^/]+)\.json$/)
  if (list && method === 'POST') return { pageRoute: `/admin/${list[1]}/new`, action: 'create', hasBody: true }

  const row = pathname.match(/^\/admin\/([^/]+)\/([^/]+)\.json$/)
  if (row && (method === 'PATCH' || method === 'PUT')) return { pageRoute: `/admin/${row[1]}/${row[2]}`, action: 'update', hasBody: true }
  if (row && method === 'DELETE') return { pageRoute: `/admin/${row[1]}/${row[2]}`, action: 'delete', hasBody: false }

  return null
}

// Any `/admin*.json` path (read or row), used to decide whether an unhandled method is a 405
// (the path is ours but the verb is wrong) vs a fall-through (not our path at all).
const isAdminJsonPath = (pathname) => pageRouteFor(pathname) !== null || /^\/admin\/[^/]+\/[^/]+\.json$/.test(pathname)

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

// A response header from the rendered pageContext (Vike stores them as [key, value] pairs,
// case-insensitively). Used to read a redirect's Location.
function headerOf(pageContext, name) {
  const headers = pageContext.httpResponse?.headers ?? []
  const found = headers.find(([k]) => k.toLowerCase() === name.toLowerCase())
  return found?.[1] ?? null
}

// Narrow a row to the columns the resource exposes (its list columns) plus the primary key,
// so the JSON never leaks a column the admin hides — a password hash, an unlisted secret.
function projectRow(row, { columns = [], pk } = {}) {
  const keys = new Set([pk, ...columns.map((c) => c.name)].filter(Boolean))
  const out = {}
  for (const k of keys) if (k in row) out[k] = row[k]
  return out
}

// The list response: rows projected to their visible columns, plus the paging/sort state.
export function projectRows(data) {
  return {
    table: data.table,
    columns: (data.columns ?? []).map((c) => ({ name: c.name, label: c.label, type: c.type })),
    rows: (data.rows ?? []).map((row) => projectRow(row, data)),
    total: data.total,
    page: data.page,
    pageCount: data.pageCount,
    pageSize: data.pageSize,
    sort: data.sort,
    dir: data.dir,
  }
}

// Translate a rendered pageContext into the caller's JSON response: a bad query / body -> 400,
// a guard / canView / canEdit redirect -> 401 (sign in) or 404 (not available to this caller).
// Shared by reads and writes; `onOk` handles the success (200) shape for each.
function respondFrom(pageContext, onOk) {
  if (pageContext.adminApiError) return json(400, { error: pageContext.adminApiError })

  const status = pageContext.httpResponse?.statusCode ?? 500
  if (status === 200 && pageContext.data) return onOk(pageContext.data)

  // After a redirect abort the user isn't re-resolved onto the returned pageContext, so
  // disambiguate by WHERE it sent the browser: the signed-in fence -> /login (must
  // authenticate, 401); a denied or unknown resource -> /admin (not available, 404 — the
  // same as the UI hiding it, without leaking unknown-vs-forbidden).
  if (status >= 300 && status < 400) {
    const location = headerOf(pageContext, 'location')
    return location && location.startsWith('/login')
      ? json(401, { error: 'Authentication required' })
      : json(404, { error: 'Resource not found or not viewable' })
  }
  return json(status >= 400 ? status : 500, { error: 'Request failed' })
}

async function render(pageRoute, request, extra = {}) {
  return renderPage({ urlOriginal: pageRoute, headersOriginal: request.headers, ...extra })
}

async function handleRead(request, pageRoute, search) {
  const pageContext = await render(pageRoute + search, request)
  return respondFrom(pageContext, (data) => json(200, 'rows' in data ? projectRows(data) : data))
}

async function handleWrite(request, target) {
  let input = {}
  if (target.hasBody) {
    try {
      input = await request.json()
    } catch {
      return json(400, { error: 'Request body must be valid JSON' })
    }
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return json(400, { error: 'Request body must be a JSON object' })
    }
  }

  // The write happens inside the page hook (newData / editData) during this render; it reads
  // the action + body off `adminApiWrite` and returns the result on pageContext.data instead
  // of redirecting. We read that result regardless of the render's HTTP status: the page
  // component can't render the write envelope (it has no form fields) and returns nothing, so
  // the HTML render is irrelevant — only the data the hook produced matters.
  const pageContext = await render(target.pageRoute, request, { adminApiWrite: { action: target.action, input } })
  if (pageContext.adminApiError) return json(400, { error: pageContext.adminApiError })
  const w = pageContext.data?.apiWrite
  if (w) {
    if (w.notFound) return json(404, { error: 'Resource not found or not viewable' })
    if (w.deleted) return json(200, { deleted: true })
    if (w.created) return json(201, projectRow(w.created, pageContext.data))
    return json(200, projectRow(w.updated, pageContext.data))
  }
  // No write was performed -> the guard / canEdit gate redirected. Reuse the read tier's
  // 401-vs-404 disambiguation.
  return respondFrom(pageContext, () => json(500, { error: 'Request failed' }))
}

// Each request object is handled at most once. A universal middleware can be collected more
// than once (an extension self-installed by several others), and a Response only
// short-circuits route handlers, not other middlewares — so without this guard a second run
// would re-read the body and, for a write, insert twice. Mirrors vike-auth's middleware.
const handled = new WeakSet()

async function adminApi(request) {
  const url = new URL(request.url)
  const method = request.method

  if (method === 'GET') {
    const pageRoute = pageRouteFor(url.pathname)
    if (!pageRoute) return // not an admin JSON read endpoint -> fall through to Vike
    if (handled.has(request)) return
    handled.add(request)
    try {
      return await handleRead(request, pageRoute, url.search)
    } catch {
      return json(500, { error: 'Internal error' })
    }
  }

  const target = writeTargetFor(url.pathname, method)
  if (!target) {
    // Our path but an unsupported verb (e.g. PATCH /admin/users.json) -> 405; anything else
    // falls through to Vike.
    return isAdminJsonPath(url.pathname) ? json(405, { error: `Method ${method} not allowed` }) : undefined
  }
  if (handled.has(request)) return
  handled.add(request)
  try {
    return await handleWrite(request, target)
  } catch {
    return json(500, { error: 'Internal error' })
  }
}

// order = AUTHENTICATION marks this as a middleware (runs on every request, returns a
// Response only for the JSON endpoints); no `path` so it sees every request, like vike-auth's.
export default enhance(adminApi, { name: 'vike-admin-api', order: MiddlewareOrder.AUTHENTICATION })
