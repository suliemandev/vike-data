// vike-rbac/telefunc-middleware — the SINGLE transport for the Telefunc seam (#110, #128):
// a universal middleware (server-agnostic: Hono / Express / Cloudflare / the Vike dev
// server) that owns the Telefunc endpoint and hands every RPC the signed-in, role-enriched
// user, so `can(user, permission)` over the Telefunc context matches `can()` on the page.
//
// ONE wiring for dev AND prod (#128). Telefunc's dev Vite plugin auto-installs a connect
// middleware on the LITERAL `/_telefunc` that calls telefunc() with no context and runs
// before Vike's onion. Rather than work around it with a second dev-only transport, the seam
// RELOCATES the endpoint (telefunc-url.js): telefunc's auto-middleware never matches our url,
// so the request falls through to THIS universal middleware in both dev and prod. We point
// telefunc's server at the relocated url below so telefunc()'s own pathname assertion
// (it checks the request path === config.telefuncUrl) accepts the request we hand it; the
// browser client is pointed there by telefunc-client.js.
//
// OPT-IN: install `telefunc`, then reference this from the app/server config:
//   middleware: ['import:vike-rbac/telefunc-middleware:default']
//   client:     'vike-rbac/telefunc-client'
import { telefunc, telefuncConfig } from 'telefunc'
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { resolveRpcUser } from './telefunc-context.js'
import { TELEFUNC_URL } from './telefunc-url.js'

// Point telefunc's SERVER at the relocated endpoint. telefunc() asserts the request pathname
// equals config.telefuncUrl, so without this it would reject the request we forward to it.
// Set once at module load (this middleware is imported on server start, before any request).
telefuncConfig.telefuncUrl = TELEFUNC_URL

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
// places it in the conventional slot; no `path` so it sees the relocated RPC request.
export default enhance(telefuncRbacMiddleware, {
  name: 'vike-rbac:telefunc',
  order: MiddlewareOrder.AUTHENTICATION,
})
