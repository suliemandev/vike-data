---
'@vike-data/kit': minor
---

@vike-data/kit: add `createSubjectResolver(defaults, envKeys)` (#264), the shared mechanism behind an extension's "rename my table(s)/column(s) by config" knob. It resolves a fixed set of named fields with precedence `override > env > default`, treats a blank/whitespace value as unset, and leaves fields with no env key as default/override-only (the reserved-column-map shape). vike-auth (`resolveSubject`) and vike-teams (`resolveTeamSubject`) now consume it instead of each hand-rolling the same precedence + blank-guard, so the two can't drift. Behaviour of both resolvers is byte-for-byte unchanged.
