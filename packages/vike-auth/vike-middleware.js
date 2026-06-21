// The wired middleware entry referenced from +config.js via the pointer import
// `import:vike-auth/middleware:default`. It binds the reusable factory
// (middleware.js) to the default in-memory auth instance (instance.js).
//
// A real app that wants a database-backed store would call createAuthMiddleware
// with its own auth instance instead of using this default — see index.js.
import { auth } from './instance.js'
import { createAuthMiddleware } from './middleware.js'

export default createAuthMiddleware(auth, { dev: process.env.NODE_ENV !== 'production' })
