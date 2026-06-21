// Programmatic surface of the framework-agnostic auth core. An app (or another
// extension) can build its own auth instance over a real database-backed store
// and pass it to createAuthMiddleware, instead of using the default in-memory
// wiring that +config.js installs.
export { createAuth } from './auth.js'
export { createMemoryStore } from './store.js'
export { createAuthMiddleware } from './middleware.js'
export { SESSION_COOKIE, MAGIC_LINK_TTL_MS, SESSION_TTL_MS } from './constants.js'
