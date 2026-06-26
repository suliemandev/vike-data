// The Telefunc HTTP endpoint the vike-rbac seam owns — deliberately NOT telefunc's
// default `/_telefunc` (#128).
//
// Telefunc's dev Vite plugin auto-installs a connect middleware that grabs the LITERAL
// `/_telefunc` and calls telefunc() with NO context, and it runs before Vike's onion — so
// a single universal middleware could never provide context under `vite dev` (its request
// was intercepted first). That used to force two transports: a dev Vite plugin AND a prod
// middleware.
//
// Relocating the endpoint removes that split. Telefunc's auto dev-middleware matches the
// literal `/_telefunc` only, so a request to THIS url never matches it (it `next()`s), and
// falls through to our ONE universal middleware (telefunc-middleware.js) in BOTH dev and
// prod, where the signed-in, role-enriched user is put on the Telefunc context. The two
// sides are pointed here through telefunc's configurable `telefuncUrl`: the browser client
// in telefunc-client.js, the server in telefunc-middleware.js.
export const TELEFUNC_URL = '/_telefunc_rbac'
