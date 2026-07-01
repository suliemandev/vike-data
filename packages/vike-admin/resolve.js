// vike-admin now consumes vike-view's framework-agnostic derivation core (schema -> view
// model, the FK-aware widget mapping, the ORM repository). This module keeps the admin's
// historical export NAMES and owns the one admin-specific piece: the `adminResources`
// cumulative config point that carries the resources this install composed.
export {
  resolveViewTables as resolveAdminTables,
  tableNamed,
  viewLabel as resourceLabel,
  canView,
  canEdit,
  buildDb,
  viewColumns,
  viewRecord,
  viewFields,
  recordTitleColumn,
  isHiddenColumn,
  titleCase,
} from 'vike-view/resolve'

// The contributed resources. A cumulative Vike config arrives as an array of per-source
// contributions (each extension's `adminResources` value is one element), so flatten it
// the same way universal-schema's resolveSchemas flattens `schemas` — a contribution may
// be an array or a function returning one. Server-env, so the resource objects arrive
// whole, functions (canView/canEdit) intact. This is the admin PRESET's config point; a
// per-table vike-view carries its view a different way, which is why it stays here and not
// in the core.
export function getResources(config) {
  return (config?.adminResources ?? []).flatMap((entry) =>
    typeof entry === 'function' ? entry(config) || [] : entry || [],
  )
}

export function findResource(config, table) {
  return getResources(config).find((r) => r.table === table) ?? null
}
