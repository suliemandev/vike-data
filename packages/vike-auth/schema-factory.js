// The table shapes vike-auth owns — `users` / `sessions` / `login_tokens` — built
// from a RESOLVED subject (table + column names), with NO env or registry read of its
// own. Factoring it here lets two callers share ONE definition so they can never drift:
//
//   - schemas.js   — the DEFAULT subject (resolveSubject(), env-backed). Today's tables.
//   - guards.js    — a NAMED guard (#267): the same three tables under the guard's own
//                    names (`admins` / `admin_sessions` / `admin_login_tokens`), so a
//                    second audience composes into the schema exactly like the first.
//
// `subject` is `{ users, sessions, loginTokens, emailColumn }` (the resolveSubject shape).
// With the default subject this returns byte-for-byte the schema vike-auth has always
// declared; with a guard's it returns the same shape under the guard's names + FK target.
import { defineSchema } from '@vike-data/vike-schema/schema'

export function buildSubjectSchemas({ users, sessions, loginTokens, emailColumn }) {
  return [
    defineSchema(users, (t) => {
      t.uuid('id').primary()
      // The subject's CONTACT column follows the knob (default `email`); an app that
      // renamed the table can call it e.g. `account_email`. The store reads/writes the
      // same resolved name, so the magic-link lookup always hits the column that exists.
      t.string(emailColumn).unique()
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
