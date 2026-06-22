// SPIKE probe — a Vike `data` hook that logs which packs composed into the cumulative
// `langMarker`. Attach to any route; read the server log.
//
// Expect (if effect-extends works) with `lang: ['ar']`:  ['base', 'ar']   (NOT 'fr')
// If effect cannot return `extends`:                      ['base']         (only the base)
export function probeData(pageContext) {
  console.error('[spike-lang] langMarker =', JSON.stringify(pageContext.config?.langMarker))
  return {}
}
