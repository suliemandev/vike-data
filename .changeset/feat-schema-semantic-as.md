---
'@vike-data/universal-schema': minor
---

universal-schema: add `.as(semantic, opts?)` to the column DSL. A column can now declare what it MEANS (`email`, `file`, `enum`, `longtext`, `json`, `date`, ...) separately from its storage `type`: `t.string('email').as('email')`, `t.string('status').as('enum', { values: ['draft', 'published'] })`. The semantic hint is a fact about the data, not a rendering instruction, so it does NOT change the storage type or the compiled DDL/migrations and rides on the column through composition. The vocabulary is open: a consumer that does not recognize a semantic type falls back to the storage type, and an extension can introduce a new one alongside the widget that renders it. This is the shared layer that lets renderers (vike-admin's field-widget registry first) derive UI from one declaration.
