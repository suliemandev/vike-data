// The Vite plugin that makes zero-config `locales: [...]` auto-include work (#79).
//
// THE PROBLEM. Each extension ships its languages as subpaths (vike-auth/fr,
// vike-auth/ar) that the app used to wire by hand:
//
//   extends: [authReact, authFr, authAr, billingAr, ...]
//
// We want the app to declare its languages ONCE and have every installed
// extension's matching pack light up:
//
//   locales: ['en', 'fr', 'ar']   // auto-includes vike-auth/fr + /ar, billing/ar, ...
//
// The blocker (spiked on #79/#83): `extends` only takes STATIC pointer-import
// strings, so we cannot compute `${ext}/ar` and feed it to `extends` from a
// config value. Making a config's effect() contribute `extends` is silently
// ignored, and returning a cumulative value from effect() crashes the resolver.
//
// THE FIX (brillout's suggestion). Sidestep Vike config composition entirely with
// a Vite VIRTUAL MODULE. Each extension advertises its catalogs as plain DATA in
// the cumulative `localePacks` registry — a `{ <locale>: <module specifier> }` map,
// just strings, so it composes like `messages`/`schemas` with no pointer-import
// resolution. This plugin reads the app's resolved `locales` + the merged registry
// (via getVikeConfig(), the same way vike-schema/plugin reads `schemas`) and
// generates a virtual module that STATICALLY imports only the packs whose locale
// is in `locales`. Vite still tree-shakes per locale (an unused locale is never
// imported, so it never lands in the bundle), and Vike never resolves a
// config-value-driven `extends`. The runtime (vike-i18n/react's LocaleWrapper)
// imports the virtual module and merges those catalogs into the dictionary.
import { getVikeConfig } from 'vike/plugin'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { committedMessages } from './translate.js'

// The id the runtime imports. The `\0` prefix on the resolved id is the Rollup
// convention for a virtual module (keeps other plugins/Vite from touching it).
const VIRTUAL_ID = 'virtual:vike-i18n/packs'
const RESOLVED_ID = '\0' + VIRTUAL_ID

// Tier 2 (#102): the AI-generated long-tail translations the user committed. Read the
// app-local `translation.json` (book-keeping `$sources` stripped by committedMessages)
// so it can be folded into the same `packs` array as the bundled tier-1 packs. It's
// plain app data, not a module specifier, so it inlines as a literal rather than an
// import — and lands AFTER the bundled packs so committed translations override them
// (committed -> bundled pack -> inline English, the #102 precedence order).
function readCommitted(root) {
  try {
    return committedMessages(JSON.parse(readFileSync(join(root, 'translation.json'), 'utf8')))
  } catch {
    return {}
  }
}

// A cumulative Vike config arrives as an array of per-source contributions; a
// contribution may itself be an array (an extension can advertise more than one
// map) or a function of the resolved config. Flatten to a flat list of
// `{ <locale>: <specifier> }` maps — the same shape resolveSchemas normalizes.
export function flattenRegistry(localePacks, config) {
  return (localePacks || []).flat().flatMap((entry) => {
    const value = typeof entry === 'function' ? entry(config) : entry
    return Array.isArray(value) ? value : value ? [value] : []
  })
}

// Read the app's `locales` + the merged `localePacks` off the resolved Vike config.
// Both are global +config values, so they land on every page's resolved config
// (a global cumulative is identical across pages) — take the first page that
// carries them, exactly like vike-schema/plugin does for `schemas`.
function readI18nConfig() {
  const pageConfigs = Object.values(getVikeConfig().pages || {}).map((p) => p.config)
  const localesConfig = pageConfigs.find((c) => c && c.locales)
  const packsConfig = pageConfigs.find((c) => c && c.localePacks && c.localePacks.length)
  const locales = (localesConfig && localesConfig.locales) || ['en']
  const registry = flattenRegistry(packsConfig && packsConfig.localePacks, packsConfig || {})
  return { locales, registry }
}

// Turn `locales` + the registry into the virtual module's source. For every advertised
// `{ locale: specifier }`, emit a static default-import for each locale that is in
// `locales` (English is the inline universal fallback, never a pack, so it never
// imports anything). Each imported module is a catalog in the `defineMessages`
// shape (`{ <locale>: { <key>: <string> } }`), the same shape `messages` entries
// use, so the runtime can merge them with `mergeMessages` unchanged.
export function generateModule(locales, registry, committed = {}) {
  const wanted = new Set(locales.filter((l) => l !== 'en'))
  const imports = []
  const consts = []
  const names = []
  let i = 0
  for (const map of registry) {
    for (const [locale, specifier] of Object.entries(map || {})) {
      if (!wanted.has(locale)) continue
      const name = `pack${i++}`
      imports.push(`import ${name} from ${JSON.stringify(specifier)}`)
      names.push(name)
    }
  }
  // Committed tier-2 translations, inlined as literals AFTER the imported packs so
  // they win in mergeMessages ("later contribution wins"). One catalog per wanted
  // locale present in translation.json; English never appears (it's the fallback).
  for (const [locale, catalog] of Object.entries(committed || {})) {
    if (!wanted.has(locale)) continue
    const name = `committed${i++}`
    consts.push(`const ${name} = ${JSON.stringify({ [locale]: catalog })}`)
    names.push(name)
  }
  return [
    '// GENERATED by vike-i18n/plugin from `locales` + the `localePacks` registry + translation.json.',
    ...imports,
    ...consts,
    `export const packs = [${names.join(', ')}]`,
    '',
  ].join('\n')
}

export function vikeI18n() {
  let config = {}
  let root = process.cwd()
  return {
    name: 'vike-i18n:packs',
    configResolved(resolved) {
      root = resolved.root
    },
    // Recompute on every (re)load so adding a language, installing an extension, or
    // re-running `vike translate` is picked up; the work is cheap (a few lookups +
    // a JSON read + concat).
    buildStart() {
      config = readI18nConfig()
      const committed = readCommitted(root)
      const out = generateModule(config.locales, config.registry, committed)
      this.info?.(
        `[vike-i18n] locales=[${config.locales.join(', ')}] -> ${
          out.split('\n').filter((l) => l.startsWith('import')).length
        } pack(s) bundled, ${Object.keys(committed).length} committed locale(s)`,
      )
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      // buildStart may not have run yet for some load orders; read lazily if so.
      if (!config.locales) config = readI18nConfig()
      return generateModule(config.locales, config.registry, readCommitted(root))
    },
  }
}

// Default export too, so it imports the same way as `vike` / vike-schema/plugin:
//   import vikeI18n from 'vike-i18n/plugin'
export default vikeI18n
