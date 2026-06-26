---
'vike-teams': minor
---

vike-teams: make its own subject table names configurable (#257). vike-teams owns `organizations` + `memberships`; their names are now configurable through one env-based knob (`VIKE_TEAMS_SUBJECT` / `VIKE_TEAMS_ORGANIZATIONS_TABLE` / `VIKE_TEAMS_MEMBERSHIPS_TABLE`), resolved at config-eval by the new `vike-teams/subject` export, mirroring the vike-auth subject pattern (#207). Renaming the org table follows through every FK that targets it (the membership `organization_id` and the `current_organization_id` added to auth's table). FKs INTO auth's subject still follow the auth rename (`VIKE_AUTH_USERS_TABLE`) independently (#256). Column names are reserved in the resolver but not env-backed, since vike-teams ships no runtime that reads them by name. Defaults are byte-for-byte today's behaviour, so the zero-config app is unchanged.
