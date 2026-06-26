// The wired middleware entry referenced from +config.js via the pointer import
// `import:vike-auth/middleware:default`. It binds the reusable factory
// (middleware.js) to the default in-memory auth instance (instance.js).
//
// A real app that wants a database-backed store would call createAuthMiddleware
// with its own auth instance instead of using this default — see index.js.
import { auth } from './instance.js'
import { createAuthMiddleware } from './middleware.js'

// Fail closed: only the local dev server gets a non-Secure cookie + the inline
// magic-link convenience, and we detect it from a POSITIVE signal - Vite/Vike
// sets NODE_ENV='development' on its dev server. Any other value (unset,
// 'staging', 'prod', a typo) keeps `Secure` on, so forgetting `NODE_ENV=production`
// in a deployment can no longer ship the 30-day session cookie over plain HTTP.
const isDevServer = process.env.NODE_ENV === 'development'

export default createAuthMiddleware(auth, { dev: isDevServer, secure: !isDevServer })
