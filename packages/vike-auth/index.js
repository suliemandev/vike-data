// Programmatic surface of the framework-agnostic auth core. An app (or another
// extension) can build its own auth instance over a real database-backed store
// and pass it to createAuthMiddleware, instead of using the default in-memory
// wiring that +config.js installs.
export { createAuth } from './auth.js'
export { createStore } from './composed-store.js'
export { createMemoryStore } from './store.js'
export { createAuthMiddleware, handleAuthRequest } from './middleware.js'
// Named guards (#267): declare a second (third, ...) auth audience. See guards.js.
// The default subject is itself the "default guard" (#276); getAllGuards() enumerates every
// audience (default + named) through one descriptor shape.
export { defineGuard, getGuard, getGuards, getDefaultGuard, getAllGuards, DEFAULT_GUARD_NAME } from './guards.js'
export { createGuardsMiddleware } from './guards-middleware.js'
export { SESSION_COOKIE, MAGIC_LINK_TTL_MS, SESSION_TTL_MS } from './constants.js'
