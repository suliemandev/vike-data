// vike-rbac/telefunc-client — the CLIENT half of the Telefunc seam's wiring (#128).
//
// Points telefunc's browser client at the relocated endpoint (telefunc-url.js), so a
// telefunction call from the browser POSTs to `/_telefunc_rbac` instead of telefunc's
// default `/_telefunc`. That endpoint is owned by our single universal middleware
// (telefunc-middleware.js) in dev AND prod, so every RPC arrives with the signed-in,
// role-enriched user on the context — the same can()/hasRole() that guards a page.
//
// Loaded as the app's Vike `client` entry (runs once on client startup, before any RPC):
//   // pages/+config.js
//   client: 'vike-rbac/telefunc-client'
import { config } from 'telefunc/client'
import { TELEFUNC_URL } from './telefunc-url.js'

config.telefuncUrl = TELEFUNC_URL
