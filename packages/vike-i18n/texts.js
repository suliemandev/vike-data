// The `exports["texts"]` convention + resolver for `vike translate` (#102).
//
// Every extension that wants the long-tail-translation treatment advertises its
// ENGLISH SOURCE strings as plain data via a `texts` entry in package.json#exports
// that points at a JSON catalog:
//
//   "exports": { "texts": "./texts.json" }   // texts.json = { "<key>": "<english>" }
//
// The catalog is JSON, not a module, on purpose: a tool can enumerate every installed
// extension's texts by READING package.json + the JSON file — never importing (and so
// never executing) the extension's code, never booting a bundler. This is the static
// discovery `vike translate` is built on (the mirror of how vike-schema reads the
// merged `schemas` config, but at the package-manifest layer instead of the Vike
// config layer). Node I/O lives here; the transforms in translate.js stay pure.
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/**
 * Pull the `texts` target out of a parsed package.json `exports` map. Supports the
 * plain string form (`"texts": "./texts.json"`) and the conditional-object form
 * (`"texts": { "default": "./texts.json" }`) — taking `default`/`import`/`require`
 * in that order — so it reads the same exotic exports maps Node's resolver accepts.
 * Returns the relative specifier, or null when the package advertises no texts.
 */
export function readTextsExport(pkgJson) {
  const entry = pkgJson && pkgJson.exports && pkgJson.exports.texts
  if (!entry) return null
  if (typeof entry === 'string') return entry
  return entry.default || entry.import || entry.require || null
}

// The dependency names declared by a package.json — every bucket, since an extension
// may sit in dependencies, devDependencies, or peerDependencies depending on the app.
function dependencyNames(pkgJson) {
  return [
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {}),
    ...Object.keys(pkgJson.peerDependencies || {}),
  ]
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

// Load `<pkgDir>/package.json` -> its texts catalog, or null if it advertises none /
// the file is unreadable. `pkgDir` is the package's own directory, so the texts
// specifier resolves relative to it.
function loadCatalogFrom(pkgDir, pkgName) {
  let pkgJson
  try {
    pkgJson = readJson(join(pkgDir, 'package.json'))
  } catch {
    return null
  }
  const rel = readTextsExport(pkgJson)
  if (!rel) return null
  const file = isAbsolute(rel) ? rel : resolve(pkgDir, rel)
  let texts
  try {
    texts = readJson(file)
  } catch {
    return null
  }
  return { pkg: pkgName || pkgJson.name, file, texts }
}

/**
 * Enumerate every installed extension's text catalog, plus the app's own. Reads the
 * app's package.json at `root`, walks its declared dependencies, and for each one that
 * lives in `node_modules` and advertises `exports["texts"]`, loads the JSON catalog.
 * The app's OWN texts (if its package.json advertises them) come LAST so the app can
 * override any extension's source string — the same "app installed last wins" rule the
 * cumulative `messages` contribution point uses.
 *
 * Returns `{ pkg, file, texts }[]` (extensions first, app last). Resolution is plain
 * `node_modules/<name>` lookup from the app root — no bundler, no import of extension
 * code. `nodeModules` overrides the search dir (handy for tests / non-standard layouts).
 */
export function discoverTextCatalogs({ root, nodeModules } = {}) {
  const appRoot = resolve(root || process.cwd())
  const appPkg = readJson(join(appRoot, 'package.json'))
  const modulesDir = nodeModules ? resolve(nodeModules) : join(appRoot, 'node_modules')

  const catalogs = []
  for (const name of dependencyNames(appPkg)) {
    const catalog = loadCatalogFrom(join(modulesDir, ...name.split('/')), name)
    if (catalog) catalogs.push(catalog)
  }
  // The app may own texts too (its own UI strings) — append last (highest precedence).
  const appCatalog = loadCatalogFrom(appRoot, appPkg.name)
  if (appCatalog) catalogs.push(appCatalog)
  return catalogs
}

/**
 * Flatten discovered catalogs into a single `{ <key>: <englishSource> }` map — the
 * input the translate core works on. Catalogs are merged in order, so a later catalog
 * (the app, by discovery order) overrides an earlier one's key. Keys are conventionally
 * namespaced by the contributor (`auth.signIn`), so cross-extension collisions are rare
 * and a deliberate app override is intentional.
 */
export function mergeSources(catalogs) {
  const out = {}
  for (const c of catalogs || []) Object.assign(out, c.texts || {})
  return out
}
