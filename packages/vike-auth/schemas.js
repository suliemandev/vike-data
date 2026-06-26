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
import { resolveSubject } from './subject.js'
import { buildSubjectSchemas } from './schema-factory.js'

export default function authSchemas(config) {
  // The shared factory builds the three tables from the resolved subject; named guards
  // (#267) reuse the EXACT same factory under their own table names, so a second audience
  // can never drift from the default's shape. The `config` arg is accepted for parity with
  // the contribution protocol but the names come from the subject knob (subject.js), the
  // single source the runtime store also reads.
  return buildSubjectSchemas(resolveSubject())
}
