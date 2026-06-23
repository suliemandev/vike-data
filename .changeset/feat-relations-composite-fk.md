---
'@vike-data/universal-schema': minor
---

Composite (multi-column) foreign keys (#130). A foreign key over two or more columns references a multi-column key as a unit, so it is declared table-level (like the composite primary key) rather than on a single column:

```js
t.foreignKey(['org_id', 'tenant_id'], 'organizations', ['id', 'tenant_id'],
             { onDelete: 'cascade', as: 'organization', inverseAs: 'memberships' })
```

It flows through the whole layer: cross-extension validation (each target column must exist, else an `unknown-reference-table` / `unknown-reference-column` conflict), dependency ordering, relation derivation (one relation carrying `fkColumns` / `refColumns` arrays), and all three compilers - Prisma `@relation(fields: [a, b], references: [x, y])`, Drizzle `foreignKey({ columns, foreignColumns })` in the table-extra block, and Rudder `t.foreign([...]).references([...]).on(table)`. The local and target column lists must be the same length and the local columns must exist (validated at definition time). One-to-one inference from a composite-unique constraint is out of scope.
