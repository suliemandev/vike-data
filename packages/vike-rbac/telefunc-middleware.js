// vike-rbac/telefunc-middleware — the PRODUCTION transport for the Telefunc seam
// (#110): a universal middleware (server-agnostic: Hono / Express / Cloudflare)
// that owns the Telefunc endpoint and hands every RPC the signed-in, role-enriched
// user, so `can(user, permission)` over the Telefunc context matches `can()` on the
// page. Resolution is shared with the dev Vite plugin via resolveRpcUser.
//
// DEV vs PROD (a real integration wrinkle, flagged for the Vike/Telefunc call):
// telefunc's Vite plugin auto-installs its OWN dev middleware for /_telefunc that
// calls telefunc() WITHOUT a context, and it runs before Vike's handler — so this
// universal middleware never sees the request under `vite dev`. The dev wiring is
// therefore telefunc-plugin.js (a Vite plugin that serves /_telefunc with context
// before telefunc's auto-middleware). THIS middleware is for a production server
// that mounts universal middlewares itself (where there is no auto-middleware).
//
// OPT-IN: install `telefunc`, then reference this from the app/server config:
//   middleware: ['import:vike-rbac/telefunc-middleware:default']
import { telefunc } from 'telefunc'
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { resolveRpcUser } from './telefunc-context.js'

const TELEFUNC_URL = '/_telefunc'

// A universal middleware runs on every request even after a sibling returns a
// Response (a Response only short-circuits route HANDLERS), and an extension's
// middleware can be collected once per install path. Guard against processing a
// request twice: re-reading its body would throw "Body already read".
const handled = new WeakSet()

async function telefuncRbacMiddleware(request) {
  const url = new URL(request.url)
  if (url.pathname !== TELEFUNC_URL) return // not an RPC — fall through to Vike
  if (handled.has(request)) return
  handled.add(request)

  const user = await resolveRpcUser(request)
  const { body, statusCode, contentType } = await telefunc({ request, context: { user } })
  return new Response(body, { status: statusCode, headers: { 'content-type': contentType } })
}

// order = AUTHENTICATION marks this as a middleware (not a route handler) and
// places it in the conventional slot; no `path` so it sees the /_telefunc request.
export default enhance(telefuncRbacMiddleware, {
  name: 'vike-rbac:telefunc',
  order: MiddlewareOrder.AUTHENTICATION,
})
