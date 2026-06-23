// vike-rbac/telefunc-plugin — the DEV wiring for the Telefunc seam (#110).
//
// Under `vite dev`, telefunc's own Vite plugin auto-installs a connect middleware
// for /_telefunc that calls telefunc() WITHOUT a context — so a telefunction's
// getContext().user is undefined and every guarded RPC errors. This plugin closes
// that gap: it registers a connect middleware that runs BEFORE telefunc's (add this
// plugin BEFORE telefunc() in vite.config), resolves the signed-in + role-enriched
// user, runs telefunc() itself WITH that context, and ends the response — so
// telefunc's context-less auto-middleware never sees the request. Same user as a
// page render, so the same can()/hasRole() guards the RPC.
//
// The production transport is the universal middleware (telefunc-middleware.js);
// this plugin is dev-only (it lives in a `configureServer` hook). Both resolve the
// user through the same resolveRpcUser, so dev and prod authorize identically.
import { telefunc } from 'telefunc'
import { resolveRpcUser } from './telefunc-context.js'

const TELEFUNC_URL = '/_telefunc'

export default function vikeRbacTelefunc() {
  return {
    name: 'vike-rbac:telefunc-context',
    // `configureServer` returning nothing registers the middleware at hook time, so
    // it runs ahead of telefunc's auto-middleware as long as this plugin is listed
    // before telefunc() in the plugins array.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (res.headersSent) return next()
        if ((req.originalUrl || req.url) !== TELEFUNC_URL) return next()
        try {
          // Wrap the Node request as a Web Request so telefunc() (and the cookie
          // read in resolveRpcUser) work off the standard API. `duplex: 'half'` is
          // required when streaming a request body in Node's fetch implementation.
          const request = new Request(`http://localhost${TELEFUNC_URL}`, {
            method: req.method,
            headers: req.headers,
            body: req,
            duplex: 'half',
          })
          const user = await resolveRpcUser(request)
          const { body, statusCode, contentType } = await telefunc({ request, context: { user } })
          res.statusCode = statusCode
          res.setHeader('content-type', contentType)
          res.end(body)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}
