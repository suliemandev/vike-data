// vike-billing — the third leg of the composition proof, done the idiomatic Vike
// way: a CONFIGURABLE extension.
//
// It declares a config key, `billingSubject`, with a default. The app overrides it
// like any Vike extension option (a sibling config key, the way vike-react takes
// `ssr` / `prerender`):
//
//   export default { extends: billingExt, billingSubject: 'user' }
//
// billing's schema is COMPUTED from that option: it contributes a function (wired
// as a pointer-import, since a runtime config value can't be an inline function),
// which vike-schema calls with the resolved config — see ./schemas.js. So the FK
// lands in `organizations` (B2B, default) or `users` (per-user) per the app's
// choice. No vike-data core change, no `billing({opts})` call: this is how a Vike
// extension is parameterized. (The codegen driver imports the same function from
// `vike-billing/schemas` directly.)

export default {
  name: 'vike-billing',
  // Self-install vike-teams (which pulls auth + vike-schema), so both `users` and
  // `organizations` exist regardless of which one the subscription FK targets.
  extends: ['import:vike-teams/config:default'],
  meta: {
    // The option the app sets to choose what billing bills against.
    billingSubject: { env: { config: true, server: true } },
  },
  // Default subject (Rom confirmed the B2B focus); the app can override it.
  billingSubject: 'organization',
  // Computed schema: a function of the resolved config, wired as a pointer-import.
  schemas: 'import:vike-billing/schemas:default',
}
