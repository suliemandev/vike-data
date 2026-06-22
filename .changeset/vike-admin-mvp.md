---
'vike-admin': minor
---

New extension: `vike-admin` ships a working admin panel on install. Add `vike-admin/react`, contribute a resource, and get `/admin/*` pages that list and create the rows of every table your extensions composed, gated by auth, in your themed layout. It writes no ORM code: the composed schema is the intent, the admin UI is derived, the resource is the refinement.

MVP vertical slice (#78): the `defineResource` / `column` / `field` DSL, the cumulative `adminResources` `+meta` seam, schema-default derivation with auto-hide (`id` / `*_hash` / timestamps), reads + inserts through universal-orm, and a signed-in guard. Detail/edit/delete, FK selects, and list pagination are follow-ups under #53.
