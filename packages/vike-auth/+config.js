// vike-auth — the keystone of the Stem Vision: an auth extension that OWNS
// everything auth needs, starting with its database tables. It declares `users`
// and `sessions` ONCE through the neutral schema DSL and contributes them via
// vike-schema's cumulative `schemas` point. It is ORM-unaware: the same
// declaration compiles to Prisma, Drizzle, or the Rudder engine.
//
// This is the framework-agnostic CORE tier (schema + server lifecycle, no UI).
// UI wrappers (vike-auth/react / vike-vue-auth) would layer components on top;
// they reuse this exact schema rather than redefining it.
//
// It self-installs vike-schema with Vike's pre-serialized pointer-import string,
// so installing vike-auth pulls vike-schema in automatically — the app needn't
// wire it. Any extension that builds on auth (e.g. vike-teams) in turn installs
// vike-auth the same way, so the whole chain composes from a single install.
//
// SERVER TIER: beyond the schema, vike-auth now contributes runtime behaviour —
//   - `middleware`: a universal middleware owning the /auth/* endpoints + the
//     session cookie (server-agnostic: Hono / Express / Cloudflare / Vike dev).
//   - `onCreatePageContext`: resolves the session cookie to `pageContext.user`
//     for rendering.
// Both are pointer-import strings (live code can't be inlined into a serialized
// config), wired to the default in-memory auth instance. See vike-middleware.js
// and oncreate.js.
//
// SUBJECT: the tables it declares are no longer hardcoded. `schemas` is a COMPUTED
// contribution (schemas.js) whose `users` / `sessions` / `login_tokens` names follow
// the subject knob (subject.js), defaulting to today's names. It is a pointer-import
// because a computed schema is a function, which a serialized config can't inline.

export default {
  name: 'vike-auth',
  extends: ['import:@vike-data/vike-schema/config:default'],
  middleware: 'import:vike-auth/middleware:default',
  onCreatePageContext: 'import:vike-auth/onCreatePageContext:default',
  meta: {
    // The user-enricher seam: extensions contribute a server-side fn that auth runs
    // after it resolves pageContext.user, on every page (see oncreate.js). vike-rbac
    // uses it to attach roles/permissions. Cumulative + server-only (it reads the
    // session-derived user and may hit the DB), and it carries pointer-imported
    // functions, so it must NOT be config-env (that would JSON-serialize the fns away).
    resolveUser: { env: { server: true }, cumulative: true },
  },
  resolveUser: [],
  // onCreatePageContext sets a serializable `pageContext.user` ({id,email,name});
  // expose it to the client so a UI hook (vike-auth/react's useUser) reads the same
  // value after hydration instead of flipping to signed-out. Cumulative — merges
  // with the host's other passToClient keys.
  passToClient: ['user'],
  schemas: 'import:vike-auth/schemas:default',
}
