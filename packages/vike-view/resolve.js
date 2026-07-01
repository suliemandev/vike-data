// The core of vike-view — framework-agnostic, no React, no Vike imports. Given the
// composed schema (the cumulative `schemas` point), it:
//
//   1. resolves the MERGED schema (the same `{ tables, columns }` the ORM artifacts
//      are generated from) — `resolveViewTables`,
//   2. builds a universal-orm repository over it on the app's adapter — `buildDb`,
//   3. derives a view's list columns / record fields / form fields from the schema,
//      applying the auto-hide convention and any view refinements —
//      `viewColumns` / `viewRecord` / `viewFields`.
//
// "Declare intent, derive implementation": the schema is the intent, these functions
// derive the view-model. Everything they return is plain + serializable (no functions),
// so a data hook can hand it straight to the client. A preset (vike-admin) or a
// per-table view both consume these; the config POINT that carries the views (which
// key holds them) is the consumer's concern, not the core's.
import { resolveSchemas, mergeSchemas } from '@vike-data/vike-schema/schema'
import { createRepository, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

// Columns hidden by convention (#53): the surrogate key, hashed secrets, and the
// framework timestamps. Unlisted columns otherwise auto-appear; a view that explicitly
// lists a hidden column overrides this.
const isHiddenColumn = (name) => name === 'id' || /_hash$/.test(name) || name === 'created_at' || name === 'updated_at'

// 'created_at' -> 'Created At', 'email' -> 'Email'. Used wherever a view omits an
// explicit label.
const titleCase = (s) =>
  String(s)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

// Resolve the cumulative `schemas` config to the merged tables. Static fragments pass
// through, computed (function) contributions are called with the resolved config.
export function resolveViewTables(config) {
  const fragments = resolveSchemas(config?.schemas ?? [], config)
  const { tables } = mergeSchemas(fragments)
  return tables
}

export function tableNamed(tables, name) {
  return tables.find((t) => t.table === name) ?? null
}

export const viewLabel = (view) => view.label ?? titleCase(view.table)

// Per-view auth. Default-open: if a view declares no predicate, a signed-in user sees it.
// Predicates refine downward.
export const canView = (view, user) => (view.canView ? !!view.canView(user) : true)
export const canEdit = (view, user) => (view.canEdit ? !!view.canEdit(user) : true)

// A universal-orm repository over the merged tables. Routes through the adapter the app
// registered (`setAdapter`); with none, falls back to a memory adapter CACHED on
// globalThis so a zero-config dev/demo run persists inserts across requests (a fresh
// adapter per request would lose every write).
const MEMORY_KEY = Symbol.for('vike-view.memory-adapter')
function fallbackAdapter() {
  if (!globalThis[MEMORY_KEY]) globalThis[MEMORY_KEY] = createMemoryAdapter()
  return globalThis[MEMORY_KEY]
}

export function buildDb(tables) {
  return createRepository({ tables }, getAdapter() ?? fallbackAdapter())
}

// Derive the LIST columns for a view. With `view.list`, honor that selection (resolving
// each spec's type from the schema); otherwise every non-hidden schema column, in schema
// order. Always plain + serializable.
export function viewColumns(view, table) {
  const byName = new Map(table.columns.map((c) => [c.name, c]))
  if (view.list?.length) {
    return view.list.map((entry) => {
      const spec = entry.build ? entry.build() : entry
      const schemaCol = byName.get(spec.name)
      return {
        name: spec.name,
        label: spec.label ?? titleCase(spec.name),
        type: schemaCol?.type ?? 'string',
        sortable: !!spec.sortable,
        searchable: !!spec.searchable,
        format: spec.format ?? null,
      }
    })
  }
  return table.columns
    .filter((c) => !isHiddenColumn(c.name))
    .map((c) => ({ name: c.name, label: titleCase(c.name), type: c.type, sortable: false, searchable: false, format: null }))
}

// A foreign-key descriptor for a column, or null. `fk` carries where a select/record cell
// reads the referenced row's label from.
const fkOf = (col) => (col?.references ? { table: col.references.table, column: col.references.column } : null)

// Derive the RECORD (detail) fields for a view — the READ-ONLY display of one row. With
// `view.record`, honor that selection (label/format refinements); otherwise every
// non-hidden schema column, in schema order. Each field carries the schema `type`, a
// `widget` (semantic-aware, so an email/enum/date renders richly), the optional client
// `format` token, and `fk` when the column references another table (so the renderer can
// show the referenced row's title instead of the raw key — the read-only twin of the
// form's FK select). Plain + serializable.
export function viewRecord(view, table) {
  const byName = new Map(table.columns.map((c) => [c.name, c]))
  const toField = (name, spec = {}) => {
    const schemaCol = byName.get(name)
    const fk = fkOf(schemaCol)
    const { widget } = fieldRender(schemaCol, fk, undefined)
    return {
      name,
      label: spec.label ?? titleCase(name),
      type: schemaCol?.type ?? 'string',
      widget,
      format: spec.format ?? null,
      ...(fk ? { fk } : {}),
    }
  }
  if (view.record?.length) {
    return view.record.map((entry) => {
      const spec = entry.build ? entry.build() : entry
      return toField(spec.name, spec)
    })
  }
  return table.columns.filter((c) => !isHiddenColumn(c.name)).map((c) => toField(c.name))
}

// Derive the FORM fields for a view. With `view.form`, honor that selection (type inferred
// from the schema unless the field overrides it); otherwise every non-hidden, writable
// schema column. `required` defaults from the schema (a non-null column with no default is
// required) and a field can override it.
export function viewFields(view, table) {
  const byName = new Map(table.columns.map((c) => [c.name, c]))
  const requiredBySchema = (col) => !!col && col.nullable === false && col.default === undefined && !col.primary

  if (view.form?.length) {
    return view.form.map((entry) => {
      const spec = entry.build ? entry.build() : entry
      const schemaCol = byName.get(spec.name)
      const fk = fkOf(schemaCol)
      const { type, widget, options } = fieldRender(schemaCol, fk, spec.type)
      return {
        name: spec.name,
        label: spec.label ?? titleCase(spec.name),
        type,
        widget,
        required: spec.required ?? requiredBySchema(schemaCol),
        ...(fk ? { fk } : {}),
        ...(options ? { options } : {}),
      }
    })
  }
  return table.columns
    .filter((c) => !isHiddenColumn(c.name))
    .map((c) => {
      const fk = fkOf(c)
      const { type, widget, options } = fieldRender(c, fk, undefined)
      return {
        name: c.name,
        label: titleCase(c.name),
        type,
        widget,
        required: requiredBySchema(c),
        ...(fk ? { fk } : {}),
        ...(options ? { options } : {}),
      }
    })
}

// A field's rendering descriptor, splitting the two concerns the form view-model carries.
// `type` is the COERCION token the data hook reads to build the row (boolean / integer /
// select / text) — kept stable so the write path is unchanged. `widget` is the RENDERING
// token the field-widget registry dispatches on: it defaults to `type`, but a column's
// SEMANTIC hint (`.as('email')`, `.as('enum')`, #176) takes precedence so one schema
// declaration drives a rich control (email / longtext / enum / date / json). An explicit
// field `.type(...)` override and a foreign key (always a select) win for BOTH. For an
// `enum` semantic the allowed values become static select `options`, in the same
// { value, label } shape the data hook fills for a foreign key.
function fieldRender(schemaCol, fk, explicitType) {
  const type = explicitType ?? (fk ? 'select' : inputType(schemaCol?.type))
  const widget = explicitType ?? (fk ? 'select' : (schemaCol?.semantic ?? inputType(schemaCol?.type)))
  const enumValues = !fk && schemaCol?.semantic === 'enum' ? schemaCol.semanticOptions?.values : null
  const options = Array.isArray(enumValues) ? enumValues.map((v) => ({ value: v, label: String(v) })) : null
  return { type, widget, options }
}

// The column a table's rows are labeled by in selects and FK cells. A view may declare
// `recordTitle`; otherwise the first non-hidden string column, else the primary key (so
// even a bare table gets a sensible label).
export function recordTitleColumn(view, table) {
  if (view?.recordTitle) return view.recordTitle
  const firstString = table.columns.find((c) => c.type === 'string' && !isHiddenColumn(c.name))
  return firstString?.name ?? table.columns.find((c) => c.primary)?.name ?? 'id'
}

// Map a schema column type to a flat input type token the form renders. Kept minimal for
// the MVP; grows with per-type fields later.
function inputType(schemaType) {
  switch (schemaType) {
    case 'boolean':
      return 'boolean'
    case 'integer':
      return 'integer'
    default:
      return 'text'
  }
}

export { isHiddenColumn, titleCase, fkOf }
