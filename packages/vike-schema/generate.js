// The pure codegen core of the vike-schema Vite plugin: a resolved Vike config in, merged
// tables + committable artifacts out. No fs, no Vike/Vite plumbing, no ctx. Extracted from
// plugin.js so this logic (ORM/mode selection, the conflict gate, artifact derivation) is
// unit-testable directly; the plugin wraps it with getVikeConfig(), the fs writes, and the
// check-mode diff. Behavior is exactly what plugin.js's run() used to inline.
import { resolveSchemas, orderFragments, mergeSchemas, generateArtifacts } from '@vike-data/universal-schema'

const DEFAULT_ORM = 'drizzle'

/** The target ORM: explicit option > VIKE_DATA_ORM env > default, lowercased. */
export function resolveOrm(orm) {
  return (orm || process.env.VIKE_DATA_ORM || DEFAULT_ORM).toLowerCase()
}

/**
 * The generation mode: explicit option wins, else `check` when VIKE_DATA_GEN=check (the CI
 * drift gate), else `write`.
 */
export function resolveMode(mode) {
  return mode || (process.env.VIKE_DATA_GEN === 'check' ? 'check' : 'write')
}

/**
 * Resolve + order + merge the contributed `schemas`, then derive per-ORM artifacts.
 *
 * Returns `{ tables, fragments, conflicts, files }`. When `mergeSchemas` reports conflicts,
 * `files` is `[]` (the caller refuses to generate and surfaces the conflicts), mirroring the
 * plugin's gate (it never calls generateArtifacts on a conflicting schema).
 *
 * @param {object} config  The resolved Vike config carrying `schemas` (and app options like
 *                         `segment` that computed/function contributions read).
 * @param {string} orm     The already-resolved ORM id ('drizzle' | 'prisma' | 'rudder').
 */
export function generateFromConfig(config, orm) {
  const fragments = orderFragments(resolveSchemas(config.schemas, config))
  const { tables, conflicts } = mergeSchemas(fragments)
  const files = conflicts.length ? [] : generateArtifacts({ tables, fragments }, orm)
  return { tables, fragments, conflicts, files }
}
