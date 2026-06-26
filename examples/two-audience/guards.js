// The two audiences (epic #255, Phase 1 / #267). Each `defineGuard` declares an
// independent vike-auth instance: its own subject table, session table, login-token table,
// session cookie (`vike_auth_session__admin` / `__client`), and endpoint namespace
// (`/admin-auth/*` / `/client-auth/*`). They share nothing — signing into one leaves the
// other untouched.
//
// This ONE module is the single source of truth for the guards. It is imported from BOTH:
//   - pages/+config.js          -> contributes each guard's tables (`guard.schemas`) to the
//                                  cumulative `schemas` point, and the per-guard login routes.
//   - pages/+onCreateGlobalContext.js -> registers the guards in the SERVER process (so the
//                                  middleware + render hook see them) and seeds a row each.
//
// `defineGuard` is idempotent per name, so importing this module on both paths is safe.
import { defineGuard } from 'vike-auth/guards'

export const guards = [
  defineGuard('admin', {
    subject: 'Admin',
    users: 'admins',
    sessions: 'admin_sessions',
    loginTokens: 'admin_login_tokens',
  }),
  defineGuard('client', {
    subject: 'Client',
    users: 'clients',
    sessions: 'client_sessions',
    loginTokens: 'client_login_tokens',
  }),
]
