// The agent API (#113): `/admin.json` and `/admin/<table>.json` — the admin's data as
// machine-readable JSON, for an AI agent (or any HTTP client) acting on a user's behalf.
//
// THE KEY IDEA: it is not a second, parallel surface with its own auth and queries — it
// is the EXACT SAME page pipeline, served as JSON. The middleware maps the `.json` URL to
// its admin page route and RENDERS it through Vike (`renderPage`): vike-auth resolves the
// user, vike-rbac enriches roles/permissions, the page guard runs, and the page's own
// data hook (dashboardData / listData) runs — the same `scope(user)` AND-merge, `canView`
// allow-list and validated `?query=` the browser UI goes through. We then return that
// hook's result (`pageContext.data`) as JSON instead of HTML. So the API inherits the
// UI's security model by construction; there is no authorization to re-implement and the
// two can never drift (they are the same code).
//
// Why a universal middleware and not a Vike page: a page render is always served as
// text/html (Vike force-sets the content type and injects client assets into the body),
// so it cannot emit clean `application/json`. A universal middleware owns its Response, so
// it returns real JSON with the right content type — the same reason vike-auth serves its
// /auth/* endpoints from a middleware.
//
// MVP scope (#113): READ only (GET). Auth is the session cookie the page pipeline already
// reads; API tokens for headless agents are a separate follow-up. Write ops (POST →
// insert/update/delete) are the next tier.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { renderPage } from 'vike/server'

// Map an `/admin*.json` request path to the admin PAGE route it mirrors, or null when the
// path isn't an admin JSON endpoint (so the request falls through to Vike untouched).
//   /admin.json            -> /admin            (the dashboard: viewable resources)
//   /admin/<table>.json    -> /admin/<table>    (a resource list)
export function pageRouteFor(pathname) {
  if (pathname === '/admin.json') return '/admin'
  const m = pathname.match(/^\/admin\/([^/]+)\.json$/)
  return m ? `/admin/${m[1]}` : null
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

// A response header from the rendered pageContext (Vike stores them as [key, value]
// pairs, case-insensitively). Used to read a redirect's Location.
function headerOf(pageContext, name) {
  const headers = pageContext.httpResponse?.headers ?? []
  const found = headers.find(([k]) => k.toLowerCase() === name.toLowerCase())
  return found?.[1] ?? null
}

// Narrow each row to the columns the resource actually exposes (its list columns) plus the
// primary key, so the JSON never leaks a column the admin hides — a password hash, an
// unlisted secret. Same columns the HTML list renders; the pk is included as the row's
// stable identity (useful to an agent, never sensitive).
export function projectRows(data) {
  const keys = new Set([data.pk, ...(data.columns ?? []).map((c) => c.name)].filter(Boolean))
  const rows = (data.rows ?? []).map((row) => {
    const out = {}
    for (const k of keys) if (k in row) out[k] = row[k]
    return out
  })
  return {
    table: data.table,
    columns: (data.columns ?? []).map((c) => ({ name: c.name, label: c.label, type: c.type })),
    rows,
    total: data.total,
    page: data.page,
    pageCount: data.pageCount,
    pageSize: data.pageSize,
    sort: data.sort,
    dir: data.dir,
  }
}

async function adminApi(request) {
  const url = new URL(request.url)
  if (request.method !== 'GET') {
    // The read tier is GET-only; a write tier (POST) is a separate follow-up. Only claim
    // the JSON paths, so a POST elsewhere still falls through to Vike.
    if (pageRouteFor(url.pathname)) return json(405, { error: 'Method not allowed (the agent API is read-only for now)' })
    return
  }
  const pageRoute = pageRouteFor(url.pathname)
  if (!pageRoute) return // not an admin JSON endpoint -> fall through to Vike's renderer

  // Render the mirrored page through the full Vike pipeline. `?query=` (and ?page/?sort)
  // ride along verbatim, so the data hook applies + validates them exactly as for the UI.
  let pageContext
  try {
    pageContext = await renderPage({ urlOriginal: pageRoute + url.search, headersOriginal: request.headers })
  } catch {
    return json(500, { error: 'Internal error' })
  }

  // A bad `?query=` is recorded by the list hook on pageContext (not an abort, so the HTML
  // list can still render); surface it as a 400 with the validation message.
  if (pageContext.adminApiError) {
    return json(400, { error: pageContext.adminApiError })
  }

  const status = pageContext.httpResponse?.statusCode ?? 500

  // Success: hand back the data hook's result. The dashboard returns its resource list
  // as-is; a list is projected to its visible columns (see projectRows).
  if (status === 200 && pageContext.data) {
    const data = pageContext.data
    return json(200, 'rows' in data ? projectRows(data) : data)
  }

  // The guard / data hook redirected (3xx) instead of rendering. After an abort the user
  // isn't re-resolved onto the returned pageContext, so disambiguate by WHERE it sent the
  // browser: the signed-in fence redirects to /login (the caller must authenticate -> 401);
  // a denied or unknown resource redirects to /admin (not available to this caller -> 404,
  // same as the UI hiding it, and without leaking unknown-vs-forbidden).
  if (status >= 300 && status < 400) {
    const location = headerOf(pageContext, 'location')
    return location && location.startsWith('/login')
      ? json(401, { error: 'Authentication required' })
      : json(404, { error: 'Resource not found or not viewable' })
  }

  return json(status >= 400 ? status : 500, { error: 'Request failed' })
}

// order = AUTHENTICATION marks this as a middleware (runs on every request, returns a
// Response only for the JSON paths); no `path` so it sees every request, like vike-auth's.
export default enhance(adminApi, { name: 'vike-admin-api', order: MiddlewareOrder.AUTHENTICATION })
