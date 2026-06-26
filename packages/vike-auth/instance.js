// The default auth instance the Vike binding wires up. It is now the instance of the
// DEFAULT GUARD (guards.js, #276): the primary, env-configured subject expressed through the
// same descriptor shape as a named guard. This module stays as a thin, back-compat alias so
// the default middleware (vike-middleware.js), the render hook (oncreate.js) and the
// server-tier seam (server.js) keep importing one shared `auth` — they need not know it now
// comes from the unified guard registry.
//
// The globalThis caching that used to live here moved into getDefaultGuard(), so duplicate
// module evaluation (different pointer imports, dev HMR) still can't fork the default store
// — every code path resolves the same default instance.
import { getDefaultGuard } from './guards.js'

/** @type {ReturnType<typeof import('./auth.js').createAuth>} */
export const auth = getDefaultGuard().instance
