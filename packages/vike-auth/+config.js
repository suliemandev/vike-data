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
import { defineSchema } from '@vike-data/vike-schema/schema'

export default {
  name: 'vike-auth',
  extends: ['import:@vike-data/vike-schema/config:default'],
  middleware: 'import:vike-auth/middleware:default',
  onCreatePageContext: 'import:vike-auth/onCreatePageContext:default',
  // onCreatePageContext sets a serializable `pageContext.user` ({id,email,name});
  // expose it to the client so a UI hook (vike-auth/react's useUser) reads the same
  // value after hydration instead of flipping to signed-out. Cumulative — merges
  // with the host's other passToClient keys.
  passToClient: ['user'],
  schemas: [
    defineSchema('users', (t) => {
      t.uuid('id').primary()
      t.string('email').unique()
      t.string('name').nullable()
      t.string('password_hash').nullable()
      t.boolean('email_verified').default(false)
      t.boolean('active').default(true)
      t.timestamps()
    }),
    defineSchema('sessions', (t) => {
      t.uuid('id').primary()
      t.uuid('user_id').references('users.id', { onDelete: 'cascade' })
      t.string('token').unique()
      t.timestamp('expires_at')
      t.timestamps()
    }),
    // Pending magic links. The server tier needs somewhere to keep single-use,
    // short-lived sign-in tokens, so it adds a table through the same DSL — the
    // schema grows with the behaviour, still derived to every ORM.
    defineSchema('login_tokens', (t) => {
      t.uuid('id').primary()
      t.string('email')
      t.string('token').unique()
      t.timestamp('expires_at')
      t.timestamp('consumed_at').nullable()
      t.timestamps()
    }),
  ],
}
