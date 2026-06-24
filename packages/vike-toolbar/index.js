// vike-toolbar — the framework-agnostic CORE.
//
// The toolbar is one fixed logo button + a popover that OTHER extensions drop simple
// settings into: a theme toggle, a locale switcher, an account link. The composition
// is the same cumulative-seam pattern the rest of the Stem set uses (`nav`, `themes`,
// `messages`, `adminResources`, `permissions`): an extension advertises a `toolbarItems`
// entry, every installed extension's entries compose, and the per-framework UI renders
// them. So installing an extension brings its settings into the popover with no toolbar
// wiring beyond the cumulative key.
//
// Zero framework imports here — this is just the item shape + the merge. The React UI
// (the button, the popover, rendering each item's control) lives in vike-toolbar/react.

// A toolbar item is `{ id, label?, order?, Control }` where Control is the per-framework
// control component (carried through the cumulative config as a pointer-import, exactly
// like vike-auth's `resolveUser` enrichers — see +config.js). `order` sorts the popover
// (ascending, default 0); ties keep contribution order (stable sort).

/**
 * Declare an extension's toolbar items for the cumulative `toolbarItems` registry.
 * Plain passthrough that fills defaults + drops malformed entries, so a contributor
 * writes `toolbarItems: defineToolbarItems([...])` and the composed list is uniform.
 */
export function defineToolbarItems(items = []) {
  // Leave `id` null when the author didn't set one — do NOT fabricate `item-${i}` here.
  // The index is local to THIS contribution, so two id-less extensions would both produce
  // `item-0`, and allToolbarItems (dedupe by id) would drop the second as a "duplicate".
  // A globally-unique fallback can only be assigned after flattening (see allToolbarItems).
  return (Array.isArray(items) ? items : [items]).filter((it) => it && it.Control).map((it) => ({
    id: it.id ?? null,
    label: it.label ?? null,
    order: Number.isFinite(it.order) ? it.order : 0,
    Control: it.Control,
  }))
}

/**
 * Flatten the cumulative registry (array of per-source arrays) into the ordered list the
 * popover renders: drops falsy/control-less entries, de-dupes by EXPLICIT `id` only (first
 * wins, so an app can't accidentally double a deliberately-identified item), sorts by
 * `order` (stable), then assigns each surviving item a unique render id. Auto (null) ids
 * never dedupe against each other, so every contributed item survives.
 */
export function allToolbarItems(contributions) {
  const flat = (contributions || []).flat().filter((it) => it && it.Control)
  const seen = new Set()
  const unique = []
  for (const it of flat) {
    const id = it.id ?? null
    if (id != null && seen.has(id)) continue
    if (id != null) seen.add(id)
    unique.push(it)
  }
  // Stable sort by order: decorate with the original index so equal orders keep their
  // contribution sequence (Array#sort is not guaranteed stable for all engines/inputs).
  // Then fill a unique fallback id by FINAL position, so the React key is always unique.
  return unique
    .map((it, i) => ({ it, i, order: Number.isFinite(it.order) ? it.order : 0 }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((x, i) => ({ ...x.it, id: x.it.id ?? `item-${i}` }))
}
