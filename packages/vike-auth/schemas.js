// vike-auth's COMPUTED schema: the same `users` / `sessions` / `login_tokens` tables
// it has always owned, but with the table names resolved from the subject knob
// (subject.js) instead of hardcoded. With no override this returns byte-for-byte the
// previous inline schema; with one set, the tables and the FK targets follow the rename.
//
// Wired into +config.js as a pointer-import (`schemas: 'import:vike-auth/schemas:default'`)
// because a runtime config value can't carry an inline function (the vike-stripe
// `subscriptionSchemas` precedent). vike-schema calls this with the resolved config when it
// generates artifacts (see universal-schema's resolveSchemas); we resolve names from env so
// the runtime store (composed-store.js) reads the EXACT same names. The `config` arg is
// accepted for parity with the contribution protocol but the names come from the subject
// knob, the single source both halves share.
import { defineSchema } from '@vike-data/vike-schema/schema'
import { resolveSubject } from './subject.js'

export default function authSchemas(config) {
  const { users, sessions, loginTokens } = resolveSubject()

  return [
    defineSchema(users, (t) => {
      t.uuid('id').primary()
      t.string('email').unique()
      t.string('name').nullable()
      t.string('password_hash').nullable()
      t.boolean('email_verified').default(false)
      t.boolean('active').default(true)
      t.timestamps()
    }),
    defineSchema(sessions, (t) => {
      t.uuid('id').primary()
      // FK column stays `user_id`; only its TARGET follows the renamed users table.
      t.uuid('user_id').references(`${users}.id`, { onDelete: 'cascade' })
      t.string('token').unique()
      t.timestamp('expires_at')
      t.timestamps()
    }),
    // Pending magic links. The server tier needs somewhere to keep single-use,
    // short-lived sign-in tokens, so it adds a table through the same DSL: the
    // schema grows with the behaviour, still derived to every ORM.
    defineSchema(loginTokens, (t) => {
      t.uuid('id').primary()
      t.string('email')
      t.string('token').unique()
      t.timestamp('expires_at')
      t.timestamp('consumed_at').nullable()
      t.timestamps()
    }),
  ]
}
