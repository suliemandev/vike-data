// The core of vike-admin — framework-agnostic, no React, no Vike imports. Given the
// composed Vike config (the cumulative `schemas` + `adminResources` points), it:
//
//   1. resolves the MERGED schema (the same `{ tables, columns }` the ORM artifacts
//      are generated from) — `resolveAdminTables`,
//   2. builds a universal-orm repository over it on the app's adapter — `buildDb`,
//   3. derives a resource's list columns / form fields from the schema, applying the
//      auto-hide convention and any resource refinements — `viewColumns` / `viewFields`.
//
// "Declare intent, derive implementation": the schema is the intent, these functions
// derive the admin view-model. Everything they return is plain + serializable (no
// functions), so a Vike data hook can hand it straight to the client.
import { resolveSchemas, mergeSchemas } from '@vike-data/vike-schema/schema'
import { createRepository, getAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'

// Columns the admin hides by convention (#53): the surrogate key, hashed secrets, and
// the framework timestamps. Unlisted columns otherwise auto-appear; a resource that
// explicitly lists a hidden column overrides this.
const isHiddenColumn = (name) => name === 'id' || /_hash$/.test(name) || name === 'created_at' || name === 'updated_at'

// 'created_at' -> 'Created At', 'email' -> 'Email'. Used wherever a resource omits an
// explicit label.
const titleCase = (s) =>
  String(s)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

// Resolve the cumulative `schemas` config to the merged tables. Mirrors the consumer
// in app/+onRenderHtml.js: static fragments pass through, computed (function)
// contributions are called with the resolved config.
export function resolveAdminTables(config) {
  const fragments = resolveSchemas(config?.schemas ?? [], config)
  const { tables } = mergeSchemas(fragments)
  return tables
}

// The contributed resources. A cumulative Vike config arrives as an array of per-source
// contributions (each extension's `adminResources` value is one element), so flatten it
// the same way universal-schema's resolveSchemas flattens `schemas` — a contribution may
// be an array or a function returning one. Server-env, so the resource objects arrive
// whole, functions (canView/canEdit) intact.
export function getResources(config) {
  return (config?.adminResources ?? []).flatMap((entry) =>
    typeof entry === 'function' ? entry(config) || [] : entry || [],
  )
}

export function findResource(config, table) {
  return getResources(config).find((r) => r.table === table) ?? null
}

export function tableNamed(tables, name) {
  return tables.find((t) => t.table === name) ?? null
}

export const resourceLabel = (resource) => resource.label ?? titleCase(resource.table)

// Per-resource auth. Default-open beyond the /admin guard: if a resource declares no
// predicate, a signed-in admin user sees it. Predicates refine downward.
export const canView = (resource, user) => (resource.canView ? !!resource.canView(user) : true)
export const canEdit = (resource, user) => (resource.canEdit ? !!resource.canEdit(user) : true)

// A universal-orm repository over the merged tables. Routes through the adapter the app
// registered (`setAdapter`); with none, falls back to a memory adapter CACHED on
// globalThis so a zero-config dev/demo run persists inserts across requests (a fresh
// adapter per request would lose every write). Same lazy-after-adapter shape as
// vike-stripe's instance.
const MEMORY_KEY = Symbol.for('vike-admin.memory-adapter')
function fallbackAdapter() {
  if (!globalThis[MEMORY_KEY]) globalThis[MEMORY_KEY] = createMemoryAdapter()
  return globalThis[MEMORY_KEY]
}

export function buildDb(tables) {
  return createRepository({ tables }, getAdapter() ?? fallbackAdapter())
}

// Derive the LIST columns for a resource. With `resource.list`, honor that selection
// (resolving each spec's type from the schema); otherwise every non-hidden schema
// column, in schema order. Always plain + serializable.
export function viewColumns(resource, table) {
  const byName = new Map(table.columns.map((c) => [c.name, c]))
  if (resource.list?.length) {
    return resource.list.map((entry) => {
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

// Derive the FORM fields for a resource. With `resource.form`, honor that selection
// (type inferred from the schema unless the field overrides it); otherwise every
// non-hidden, writable schema column. `required` defaults from the schema (a non-null
// column with no default is required) and a field can override it.
export function viewFields(resource, table) {
  const byName = new Map(table.columns.map((c) => [c.name, c]))
  const requiredBySchema = (col) => !!col && col.nullable === false && col.default === undefined && !col.primary
  // A column with a foreign key becomes a select; the data hook fills its `options` from
  // the referenced table. `fk` carries where to read them from.
  const fkOf = (col) => (col?.references ? { table: col.references.table, column: col.references.column } : null)

  if (resource.form?.length) {
    return resource.form.map((entry) => {
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
// select / text) — kept stable so the write path (data.js) is unchanged and back-compatible.
// `widget` is the RENDERING token the form's field-widget registry dispatches on: it defaults
// to `type`, but a column's SEMANTIC hint (`.as('email')`, `.as('enum')`, #176) takes
// precedence so one schema declaration drives a rich control (email / longtext / enum / date /
// json). An explicit field `.type(...)` override and a foreign key (always a select) win for
// BOTH, exactly as before. For an `enum` semantic the allowed values become static select
// `options`, in the same { value, label } shape the data hook fills for a foreign key — so the
// select widget renders them with no extra wiring (and the FK option-loader leaves them alone).
function fieldRender(schemaCol, fk, explicitType) {
  const type = explicitType ?? (fk ? 'select' : inputType(schemaCol?.type))
  const widget = explicitType ?? (fk ? 'select' : (schemaCol?.semantic ?? inputType(schemaCol?.type)))
  const enumValues = !fk && schemaCol?.semantic === 'enum' ? schemaCol.semanticOptions?.values : null
  const options = Array.isArray(enumValues) ? enumValues.map((v) => ({ value: v, label: String(v) })) : null
  return { type, widget, options }
}

// The column a table's rows are labeled by in selects and FK cells. A resource may
// declare `recordTitle`; otherwise the first non-hidden string column, else the primary
// key (so even a bare table gets a sensible label).
export function recordTitleColumn(resource, table) {
  if (resource?.recordTitle) return resource.recordTitle
  const firstString = table.columns.find((c) => c.type === 'string' && !isHiddenColumn(c.name))
  return firstString?.name ?? table.columns.find((c) => c.primary)?.name ?? 'id'
}

// Map a schema column type to a flat input type token the React form renders. Kept
// minimal for the MVP; grows with per-type fields later.
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

export { isHiddenColumn, titleCase }
