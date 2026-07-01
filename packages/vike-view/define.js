// The view DSL. A VIEW is the REFINEMENT on top of a table in the composed schema:
// the schema is the intent, the UI (list / record / form) is derived, and a view only
// declares what differs from the derived default.
//
// The minimal case is `defineView({ table: 'posts' })` — every column derives from the
// schema, full list + record + form. You reach for `list`/`record`/`form` and the
// `column()` / `display()` / `field()` builders only to refine: pick/rename/order
// columns, mark a field's input type, gate with `canView` / `canEdit`, scope to owned rows.
//
// The builders are deliberately FLAT (`field('x').type('select')`, not a per-type
// subclass). `.build()` collapses a builder to a plain spec; resolve.js calls it, so a
// view author can pass either a builder or a bare spec object.

// A list column: how a schema column appears in the list table.
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

// A record (detail) field: how a schema column appears as a read-only cell on the record
// view. Same refinements a list column carries that make sense for read-only display
// (label + format); no sortable/searchable (a detail page shows one row).
export function display(name) {
  const spec = { name }
  const self = {
    label(text) {
      spec.label = text
      return self
    },
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

// A form field: how a schema column appears as an input in the create/edit form.
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

// Declare a view. `table` (a table in the COMPOSED schema, not a Model class) is the only
// required field; everything else refines the schema-derived default.
//
//   defineView({
//     table: 'posts',
//     label: 'Posts',
//     list:   [ column('title').sortable(), column('created_at').format('since') ],
//     record: [ display('title'), display('body'), display('author') ],
//     form:   [ field('title').required(), field('body'), field('status').type('select') ],
//     canView: (user) => !!user,
//     canEdit: (user) => user?.role === 'admin',
//     // Row scoping (#104): bound a user to their OWN rows. Return a universal-orm filter,
//     // or a falsy value for full access (encode the admin bypass here). The filter is
//     // AND-merged into list/load/update/delete and forced onto inserts.
//     scope: (user) => (user?.role === 'admin' ? null : { user_id: user.id }),
//   })
export function defineView(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('defineView: expected a definition object, e.g. defineView({ table: "posts" })')
  }
  if (typeof def.table !== 'string' || !def.table) {
    throw new Error('defineView: `table` (a table name in the composed schema) is required')
  }
  return { icon: null, ...def }
}
