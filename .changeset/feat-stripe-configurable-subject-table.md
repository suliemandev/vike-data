---
'vike-stripe': minor
---

vike-stripe: make the segment subject FK target table configurable (#259). The subject FK target was hardcoded to the segment literal (`users.id` for b2c, `organizations.id` for b2b), so it followed neither the auth-subject rename (#207) nor the teams-subject rename (#257). Both schema factories now accept an optional `subjectTable` config (also declared on the subscription/purchase `+config.js` meta), defaulting to the segment literal; the FK column stays segment-derived. vike-stripe deliberately does not import vike-auth/vike-teams (it stays decoupled, #250), so the app passes the resolved table name (`subjectTable: resolveSubject().users` for b2c, or the teams resolver for b2b) at the call site. Default is byte-for-byte unchanged.
