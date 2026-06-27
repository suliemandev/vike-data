// The TEAM SUBJECT knob: which subject vike-teams owns and which tables it owns.
// Mirrors vike-auth's `subject.js` (the worked precedent), one tier up the Stem:
// auth owns `users`, teams owns `organizations` + `memberships`. Defaults to
// `Organization` over `organizations` / `memberships` (today's behaviour,
// byte-for-byte). An app renames the subject + tables through ONE surface (env),
// read HERE so the schema contribution is the single source.
//
// Why env, not a `+config` value: same call as vike-auth. A +config CAN be read by
// the schema factory, but routing the override through env keeps it a SINGLE source
// the app sets once, consistent with how auth (VIKE_AUTH_*) and stripe
// (BILLING_SEGMENT) take their build/runtime knobs.
//
// SCOPE (#257): the subject + TABLE names are configurable. vike-teams ships no
// runtime store of its own (it is pure schema), so no COLUMN carries in-package
// behaviour the way auth's `emailColumn` carries magic-link login. The column map
// below is therefore RESERVED (default/override only, not env-backed and not
// threaded) for shape stability, exactly as auth reserves `nameColumn` / `idColumn`:
// the single place to grow when a real consumer needs a renamed column, without
// shipping an env var that silently does nothing. Cross-extension FKs INTO auth's
// subject still follow the auth rename via `vike-auth/subject` (#256), unchanged.

import { createSubjectResolver } from '@vike-data/kit'

// Today's names. Frozen so a caller can't mutate the shared defaults.
export const DEFAULT_TEAM_SUBJECT = Object.freeze({
  team: 'Organization',
  organizations: 'organizations',
  memberships: 'memberships',
  // The invitation flow's table (#292). Threaded into the schema like the other two, so a
  // renamed app keeps one source of truth. Default is today's name.
  invitations: 'invitations',
  // Column names on the team tables. None are wired today (see scope note); reserved.
  slugColumn: 'slug',
  roleColumn: 'role',
  nameColumn: 'name',
  idColumn: 'id',
})

// Map each resolved field to its env var. `team` is the human/label name; the two
// table fields are threaded into the schema. The column fields are intentionally
// absent — reserved (default/override only) until a consumer needs them, so we never
// ship an env var that silently does nothing.
const ENV_KEYS = {
  team: 'VIKE_TEAMS_SUBJECT',
  organizations: 'VIKE_TEAMS_ORGANIZATIONS_TABLE',
  memberships: 'VIKE_TEAMS_MEMBERSHIPS_TABLE',
  invitations: 'VIKE_TEAMS_INVITATIONS_TABLE',
}

// Resolve the team subject config. Precedence per field: explicit `overrides` (used by
// tests, which call this directly) > env > default. `env` defaults to `process.env`. A
// blank/whitespace-only env value is treated as unset (falls through to the default), so
// an empty `VIKE_TEAMS_ORGANIZATIONS_TABLE=` in a .env never produces a nameless table.
// The column fields have no ENV_KEYS entry, so they resolve from override/default only
// (reserved; see scope note). The precedence + blank-guard mechanism is shared via kit's
// `createSubjectResolver`, the same one vike-auth's resolver uses.
export const resolveTeamSubject = createSubjectResolver(DEFAULT_TEAM_SUBJECT, ENV_KEYS)
