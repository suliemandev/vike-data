// vike-auth — the keystone of the Stem Vision: an auth extension that OWNS
// everything auth needs, starting with its database tables. It declares `users`
// and `sessions` ONCE through the neutral schema DSL and contributes them via
// vike-schema's cumulative `schemas` point. It is ORM-unaware: the same
// declaration compiles to Prisma, Drizzle, or the native engine.
//
// This is the framework-agnostic CORE tier (schema + server lifecycle, no UI).
// UI wrappers (vike-react-auth / vike-vue-auth) would layer components on top;
// they reuse this exact schema rather than redefining it.
//
// It self-installs vike-schema with Vike's pre-serialized pointer-import string,
// so installing vike-auth pulls vike-schema in automatically — the app needn't
// wire it. Any extension that builds on auth (e.g. vike-teams) in turn installs
// vike-auth the same way, so the whole chain composes from a single install.
import { defineSchema } from '@vike-data/vike-schema/schema'

export default {
  name: 'vike-auth',
  extends: ['import:@vike-data/vike-schema/config:default'],
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
      t.uuid('user_id')
      t.string('token').unique()
      t.timestamp('expires_at')
      t.timestamps()
    }),
  ],
}
