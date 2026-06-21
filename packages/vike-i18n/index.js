// vike-i18n — the framework-agnostic LOCALIZATION core.
//
// The composition story applied to translations. Vike already does locale ROUTING
// (onBeforeRoute + pageContext.locale); this is the layer on top: a cumulative
// `messages` contribution point so EXTENSIONS ship their own translated strings
// that merge into the app the same way `schemas` and `themes` compose. The app
// composes everyone's messages, picks the active locale, and can override any
// extension string. Zero framework imports; a React/Vue wrapper just calls these.

/**
 * Normalize a messages map: { <locale>: { <key>: <string> } }. Plain data — keys
 * are conventionally namespaced by the contributor (e.g. `auth.signIn`) to avoid
 * collisions, but a later contribution overriding an earlier key is intentional
 * (it lets the app retranslate an extension's string).
 */
export function defineMessages(messages = {}) {
  return messages
}

/**
 * Merge cumulative contributions into the dictionary for one locale. The
 * `fallback` locale is laid down first (so a missing translation falls back to
 * it), then the active locale overrides; within each layer, later contributions
 * win (the app, installed last, overrides extensions).
 */
export function mergeMessages(contributions, locale, fallback = 'en') {
  const list = (contributions || []).flat()
  const out = {}
  for (const c of list) Object.assign(out, c?.[fallback] || {})
  if (locale && locale !== fallback) {
    for (const c of list) Object.assign(out, c?.[locale] || {})
  }
  return out
}

/** Look up a key and interpolate `{var}` placeholders. Missing key -> the key. */
export function translate(dict, key, vars) {
  let s = dict && dict[key] != null ? dict[key] : key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** Every locale any contribution provides (for a locale picker), fallback first. */
export function availableLocales(contributions, fallback = 'en') {
  const set = new Set([fallback])
  for (const c of (contributions || []).flat()) for (const l of Object.keys(c || {})) set.add(l)
  return [...set]
}
