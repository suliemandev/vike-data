// The REAL codegen hook (replaces the app-owned generate.mjs stand-in).
//
// A Vite plugin contributed by vike-schema. It runs on `vike build` and on dev
// server start, reads Vike's RESOLVED config graph via getVikeConfig() — the
// merged cumulative `schemas` from every installed extension, plus the app's
// own config (e.g. `billingSubject`) — and writes the per-ORM artifacts.
//
// The difference from the stand-in: the stand-in hard-coded the contribution
// list (`[vikeSchema.schemas, authExt.schemas, ...]`) and re-read env. This
// reads what Vike actually merged, so adding/removing an extension needs no
// change here, and computed (function) contributions are already resolved
// against the same config Vike gives every other consumer.
import { getVikeConfig } from 'vike/plugin'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveSchemas, orderFragments, mergeSchemas, generateArtifacts } from '@vike-data/universal-schema'

export function vikeSchemaGenerate(options = {}) {
  let root = process.cwd()

  async function run(ctx) {
    // `schemas` is contributed at the global +config level, so it lands on every
    // page's resolved config (the same value the runtime consumer reads via
    // pageContext.config.schemas). Read it from the page config — that resolved
    // config object also carries the app's options (e.g. billingSubject), which
    // computed (function) contributions need. Take the first page that has it;
    // a global cumulative config is identical across pages.
    const pageConfigs = Object.values(getVikeConfig().pages || {}).map((p) => p.config)
    const config = pageConfigs.find((c) => c && c.schemas)
    if (!config) {
      ctx.warn?.('[vike-schema] no `schemas` found in the Vike config; nothing to generate.')
      return
    }
    const orm = (options.orm || process.env.VIKE_DATA_ORM || 'drizzle').toLowerCase()
    // `check` mode is the CI drift gate: generate in memory, compare to disk,
    // fail if anything is stale or missing — never write.
    const mode = options.mode || (process.env.VIKE_DATA_GEN === 'check' ? 'check' : 'write')

    // Resolve + dedupe, then order by FK dependency so native migrations are
    // emitted in a runnable order regardless of Vike's (non-dependency-aware)
    // contribution order.
    const fragments = orderFragments(resolveSchemas(config.schemas, config))
    const { tables, conflicts } = mergeSchemas(fragments)
    if (conflicts.length) {
      const lines = conflicts.map((c) => `  - ${c.kind}: ${c.table}${c.column ? '.' + c.column : ''}`)
      ctx.error(`[vike-schema] refusing to generate, ${conflicts.length} schema conflict(s):\n${lines.join('\n')}`)
      return
    }

    const files = generateArtifacts({ tables, fragments }, orm)
    const drift = []
    for (const f of files) {
      const abs = join(root, f.path)
      if (mode === 'check') {
        const current = await readFile(abs, 'utf8').catch(() => null)
        if (current !== f.contents) drift.push(f.path)
        continue
      }
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, f.contents)
    }

    if (mode === 'check') {
      if (drift.length) {
        ctx.error(`[vike-schema] ${orm} artifacts are stale (run generation):\n${drift.map((p) => `  - ${p}`).join('\n')}`)
      } else {
        ctx.info?.(`[vike-schema] ${orm} artifacts up to date (${files.length} file(s)).`)
      }
      return
    }
    ctx.info?.(`[vike-schema] generated ${files.length} ${orm} artifact(s) from ${tables.length} merged tables.`)
  }

  return {
    name: 'vike-schema:generate',
    configResolved(resolved) {
      root = resolved.root
    },
    // buildStart fires for both `vite build` and the dev server, so artifacts
    // stay in sync without an explicit command. Generation is per-ORM (the app
    // picks via VIKE_DATA_ORM, mirroring the dev script).
    buildStart() {
      return run(this)
    },
  }
}
