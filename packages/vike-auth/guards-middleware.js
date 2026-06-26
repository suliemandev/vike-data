// The guards request handler: ONE universal middleware that dispatches over the guard
// registry (guards.js). On each request it finds the guard whose endpoint base matches
// (`/admin-auth/...` -> the `admin` guard) and runs the shared auth handler bound to THAT
// guard's instance + cookie. A request matching no guard's base falls through to Vike.
//
// Wired by the app via the guards config (react/guards/+config.js); the default
// single-subject path never installs it, so an app with no guards is byte-for-byte
// unchanged. It is also inert until a guard is declared: an empty registry matches nothing
// and every request falls through.
//
// It reuses handleAuthRequest (middleware.js) — the exact endpoint logic, cookie handling
// and security invariants the default middleware runs — so a named guard can never drift
// from the default's behaviour; only the instance, cookie name and base path differ.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { handleAuthRequest } from './middleware.js'
import { getGuards } from './guards.js'

export function createGuardsMiddleware({ dev = false, secure = true } = {}) {
  async function guardsDispatch(request) {
    const { pathname } = new URL(request.url)
    for (const guard of getGuards()) {
      if (pathname.startsWith(`${guard.basePath}/`)) {
        return handleAuthRequest(request, {
          auth: guard.instance,
          cookieName: guard.cookieName,
          basePath: guard.basePath,
          dev,
          secure,
        })
      }
    }
    return // no guard owns this path: fall through to Vike's renderer
  }

  // Same slot as the default auth middleware (AUTHENTICATION); a distinct name so Vike
  // keeps it as its own contribution rather than deduping it against the default.
  return enhance(guardsDispatch, { name: 'vike-auth-guards', order: MiddlewareOrder.AUTHENTICATION })
}

// Fail closed, the same derivation as the default wiring (vike-middleware.js): only the
// local dev server gets a non-Secure cookie + the inline magic-link convenience, detected
// from the POSITIVE signal NODE_ENV='development'. Any other value keeps `Secure` on.
const isDevServer = process.env.NODE_ENV === 'development'

export default createGuardsMiddleware({ dev: isDevServer, secure: !isDevServer })
