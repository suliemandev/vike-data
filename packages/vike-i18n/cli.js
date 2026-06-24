// `vike translate` — the developer command (#102, tier 2 i18n).
//
// Enumerate every installed extension's source texts (+ the app's own), figure out
// which locale+key pairs are missing or stale, AI-translate just those, and write a
// single `translation.json` the user commits. It is a CODEGEN-STYLE GATE, the i18n
// twin of vike-schema's `gen` / `gen:check`: deterministic, re-runnable, and with a
// `--check` mode CI can fail on when the committed file drifts from the source texts.
// No AI runs at build/CI/runtime — translation is a developer action, re-run when
// source texts change.
//
// This module is the I/O + orchestration shell; the policy is the pure core
// (translate.js) and discovery (texts.js), and the AI call is the provider
// (translator.js, swappable via `--provider` / an injected `translate`).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { discoverTextCatalogs, mergeSources } from './texts.js'
import { planTranslations, applyTranslations, SOURCES_KEY } from './translate.js'
import { createAnthropicTranslator } from './translator.js'

function readExisting(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

// The committed file determines which locales already exist; we reuse them when the
// caller doesn't pass `--locales`, so a bare `vike translate` re-fills the locales the
// repo already targets. `$sources` is metadata, not a locale.
function localesFromExisting(existing) {
  return Object.keys(existing || {}).filter((k) => k !== SOURCES_KEY)
}

// Group the flat plan into per-locale batches — the shape the provider consumes (one
// AI call per locale instead of per key).
function groupByLocale(items) {
  const byLocale = new Map()
  for (const item of items) {
    if (!byLocale.has(item.locale)) byLocale.set(item.locale, [])
    byLocale.get(item.locale).push({ key: item.key, source: item.source })
  }
  return byLocale
}

/**
 * Run a translate pass. Pure-ish around two side effects (read+write the file) and one
 * injected effect (the provider). Returns a structured summary so callers/tests can
 * assert without parsing logs.
 *
 * options:
 *   - root        app dir (default cwd) — where package.json + node_modules live.
 *   - out         the committed file (default `<root>/translation.json`).
 *   - locales     target locales; English is always the inline fallback and never a
 *                 target. Falls back to the locales already in the file.
 *   - check       drift gate: never write; return `{ ok }` = is the file up to date.
 *   - translate   a custom provider `(job) => { [key]: string }` (skips the default).
 *   - model/apiKey passed to the default Anthropic provider.
 *   - nodeModules override the discovery dir (tests / non-standard layouts).
 *   - log         sink for human progress (default stderr).
 */
export async function runTranslate(options = {}) {
  const root = resolve(options.root || process.cwd())
  const out = options.out ? resolve(options.out) : join(root, 'translation.json')
  const log = options.log || ((msg) => process.stderr.write(msg + '\n'))

  const existing = readExisting(out)
  const locales = (options.locales && options.locales.length ? options.locales : localesFromExisting(existing)).filter(
    (l) => l && l !== 'en',
  )

  const catalogs = discoverTextCatalogs({ root, nodeModules: options.nodeModules })
  const sources = mergeSources(catalogs)
  const sourceKeyCount = Object.keys(sources).length
  log(`[vike translate] ${sourceKeyCount} source key(s) from ${catalogs.length} catalog(s); locales=[${locales.join(', ') || '-'}]`)

  const plan = planTranslations(sources, locales, existing)

  if (options.check) {
    const ok = plan.items.length === 0 && plan.removedKeys.length === 0
    if (!ok) {
      const detail = []
      if (plan.items.length) detail.push(`${plan.items.length} missing/stale entr(y/ies)`)
      if (plan.removedKeys.length) detail.push(`${plan.removedKeys.length} removed key(s)`)
      log(`[vike translate] translation.json is OUT OF DATE: ${detail.join(', ')}. Run \`vike translate\`.`)
    } else {
      log('[vike translate] translation.json is up to date.')
    }
    return { ok, mode: 'check', plan, locales }
  }

  if (!locales.length) {
    log('[vike translate] no target locales — pass --locales or add some to translation.json. Nothing to do.')
    return { ok: true, mode: 'write', written: false, plan, locales }
  }

  // Translate only the gaps, one batch per locale.
  const provider = createAnthropicTranslator(options)
  const results = []
  for (const [locale, items] of groupByLocale(plan.items)) {
    log(`[vike translate] translating ${items.length} string(s) -> ${locale} ...`)
    const map = await provider({ locale, items })
    for (const { key } of items) {
      if (map[key] != null) results.push({ locale, key, value: map[key] })
    }
  }

  const merged = applyTranslations(existing, sources, locales, results)
  const changed = JSON.stringify(merged) !== JSON.stringify(existing)
  if (changed) writeFileSync(out, JSON.stringify(merged, null, 2) + '\n')
  log(
    changed
      ? `[vike translate] wrote ${out} (${results.length} translated, ${plan.removedKeys.length} pruned).`
      : '[vike translate] translation.json already up to date.',
  )
  return { ok: true, mode: 'write', written: changed, translation: merged, plan, locales }
}

// Minimal flag parser — `--root <dir>`, `--out <file>`, `--locales a,b,c` (or
// `--locales=a,b`), `--check`, `--model <id>`, `--node-modules <dir>`, `--help`.
export function parseArgs(argv) {
  const opts = {}
  const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.indexOf('=')
    const flag = eq === -1 ? arg : arg.slice(0, eq)
    const inlineVal = eq === -1 ? undefined : arg.slice(eq + 1)
    const next = () => (inlineVal !== undefined ? inlineVal : argv[++i])
    switch (flag) {
      case '--check':
        opts.check = true
        break
      case '--root':
        opts.root = next()
        break
      case '--out':
        opts.out = next()
        break
      case '--locales':
        opts.locales = list(next())
        break
      case '--model':
        opts.model = next()
        break
      case '--node-modules':
        opts.nodeModules = next()
        break
      case '--help':
      case '-h':
        opts.help = true
        break
      default:
        break
    }
  }
  return opts
}

const HELP = `vike translate — AI-translate extension + app texts into translation.json (#102)

Usage:
  vike-translate [--locales en,fr,ar] [--check] [--root .] [--out translation.json]

Options:
  --locales <list>   Comma-separated target locales (English is always the inline
                     fallback). Defaults to the locales already in translation.json.
  --check            Drift gate: exit non-zero if translation.json is missing/stale
                     entries. Never writes. Use in CI alongside your gen:check.
  --root <dir>       App directory (package.json + node_modules). Default: cwd.
  --out <file>       Output file. Default: <root>/translation.json.
  --model <id>       Model for the default Anthropic provider. Default: claude-opus-4-8.
  --node-modules <dir>  Override the discovery directory.

Env:
  ANTHROPIC_API_KEY  Required by the default provider (write mode only).`

/** Entry point for the bin: parse argv, run, set exit code on a failed `--check`. */
export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.help) {
    process.stdout.write(HELP + '\n')
    return 0
  }
  const result = await runTranslate(opts)
  return result.ok ? 0 : 1
}
