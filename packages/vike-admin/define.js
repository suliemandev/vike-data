// The resource DSL — vike-admin's `define*` member (the family: defineSchema,
// defineTheme, defineLayout, ...). A resource is the REFINEMENT on top of a table in
// the composed schema: the schema is the intent, the admin UI is derived, and a
// resource only declares what differs from the derived default.
//
// The minimal case is `defineResource({ table: 'subscriptions' })` — every column
// derives from the schema, full list + create. You reach for `list`/`form` and the
// `column()` / `field()` builders only to refine: pick/rename/order columns, mark a
// field's input type, gate with `canView` / `canEdit`.
//
// The builders are deliberately FLAT (`field('x').type('select')`, not a per-type
// subclass) — they grow toward per-type richness later (#53). `.build()` collapses a
// builder to a plain spec; resolve.js calls it, so a resource author can pass either a
// builder or a bare spec object.

// A list column: how a schema column appears in the /admin/:table table.
export function column(name) {
  const spec = { name }
  const self = {
    sortable() {
      spec.sortable = true
      return self
    },
    searchable() {
      spec.searchable = true
      return self
    },
    label(text) {
      spec.label = text
      return self
    },
    // A named, client-applied formatter (e.g. 'since' for a relative timestamp). A
    // string token, not a function, so the resolved column stays serializable to the
    // client. Unknown tokens render the raw value.
    format(token) {
      spec.format = token
      return self
    },
    build() {
      return { ...spec }
    },
  }
  return self
}

// A form field: how a schema column appears as an input in the create form.
export function field(name) {
  const spec = { name }
  const self = {
    // Override the input type the schema would infer (e.g. `.type('email')` on a
    // string column, `.type('select')` later). Flat for now.
    type(inputType) {
      spec.type = inputType
      return self
    },
    label(text) {
      spec.label = text
      return self
    },
    required(isRequired = true) {
      spec.required = isRequired
      return self
    },
    build() {
      return { ...spec }
    },
  }
  return self
}

// Declare a resource. `table` (a table in the COMPOSED schema, not a Model class) is
// the only required field; everything else refines the schema-derived default.
//
//   defineResource({
//     table: 'users',
//     label: 'Users',
//     list: [ column('email').sortable(), column('created_at').format('since') ],
//     form: [ field('email').type('email').required(), field('name') ],
//     canView: (user) => !!user,
//     canEdit: (user) => user?.role === 'admin',
//   })
export function defineResource(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('defineResource: expected a definition object, e.g. defineResource({ table: "users" })')
  }
  if (typeof def.table !== 'string' || !def.table) {
    throw new Error('defineResource: `table` (a table name in the composed schema) is required')
  }
  return { icon: null, ...def }
}
