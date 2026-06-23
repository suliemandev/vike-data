---
'@vike-data/universal-schema': minor
---

Infer one-to-one for shared-primary-key foreign keys (#129). `deriveRelations` already treated a `unique` FK as one-to-one; it now also treats a single-column FK that is itself the table's primary key (e.g. `profiles.id` both PK and `references('users.id')`) as one-to-one, so the Prisma inverse field renders `Model?` instead of `Model[]`. Only the column-level `.primary()` flag qualifies, so a column that is merely a member of a composite `t.primaryKey(...)` (a many-to-many join table) stays one-to-many.
