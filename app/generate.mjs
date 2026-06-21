// `vike generate` stand-in — the trigger for the proposed codegen primitive.
//
// What changed vs the old vike-data-specific script: this driver no longer knows
// anything about ORMs or schemas. It (1) resolves a small context from the app
// (here by reading configs + scanning pages; a real Vike build hook reads its
// resolved + config graph), (2) registers GENERATORS, and (3) hands both to
// @vike-data/codegen, which runs every generator, enforces the `.generated.`
// convention + header, and either writes or `--check`s for drift.
//
// Two generators are registered to prove the primitive is generator-agnostic,
// not schema-coupled:
//   - the @vike-data schema generator (schema.generated.prisma / drizzle / native)
//   - a typed-routes generator (routes.generated.ts) — a mini vikejs/vike#698,
//     showing Vike's OWN internal codegen is just another consumer of this.
//
//   node generate.mjs            # write (uses VIKE_DATA_ORM, defaults to drizzle)
//   node generate.mjs --check    # CI drift check: exit 1 if any file is stale
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { mergeSchemas, schemaArtifacts } from '@vike-data/vike-schema/schema'
import { materialize } from '@vike-data/codegen'
import vikeSchema from '@vike-data/vike-schema/config'
import authExt from 'example-auth/config'
import billingExt from 'example-billing/config'

// --- resolve context (a real binding reads Vike's resolved + config graph) ----
const installed = [vikeSchema, authExt, billingExt]
const fragments = installed.flatMap((c) => c.schemas || []).flat()
const { tables, conflicts } = mergeSchemas(fragments)
if (conflicts.length) {
  console.error(`Refusing to generate: ${conflicts.length} schema conflict(s):`)
  for (const c of conflicts) console.error(`  - ${c.kind}: ${c.table}${c.column ? '.' + c.column : ''}`)
  process.exit(1)
}

// Discover the app's pages (Vike resolves these for real; we scan for the spike).
async function findRoutes(pagesDir, base = '') {
  const out = []
  for (const entry of await readdir(pagesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...(await findRoutes(join(pagesDir, entry.name), `${base}/${entry.name}`)))
    } else if (entry.name === '+Page.js') {
      out.push(base === '/index' || base === '' ? '/' : base.replace(/\/index$/, ''))
    }
  }
  return out
}
const routes = [...new Set(await findRoutes(join(process.cwd(), 'pages')))].sort()

const orm = (process.env.VIKE_DATA_ORM || 'drizzle').toLowerCase()
const context = { schema: { tables, fragments }, orm, routes }

// --- generators: the registry the primitive consumes ---------------------------
const schemaGenerator = {
  name: '@vike-data/vike-schema',
  files: (ctx) => schemaArtifacts(ctx.schema, ctx.orm),
}

// A second, schema-unrelated generator: typed routes (mini vikejs/vike#698).
const routesGenerator = {
  name: 'vike:typed-routes',
  files: (ctx) => {
    const union = ctx.routes.map((r) => `  | '${r}'`).join('\n')
    const list = ctx.routes.map((r) => `'${r}'`).join(', ')
    const body = `export type Route =\n${union}\n\nexport const routes = [${list}] as const\n`
    return [{ path: 'routes.generated.ts', comment: '//', body }]
  },
}

// --- materialize ---------------------------------------------------------------
const mode = process.argv.includes('--check') ? 'check' : 'write'
const report = await materialize({ generators: [schemaGenerator, routesGenerator], context, mode })

if (mode === 'check') {
  if (report.drift.length) {
    console.error(`Drift: ${report.drift.length} generated file(s) out of date. Run \`vike generate\`.`)
    for (const d of report.drift) console.error(`  - ${d.path} (${d.reason})`)
    process.exit(1)
  }
  console.log(`Up to date: ${report.ok.length} generated file(s) match.`)
} else {
  for (const p of report.written) console.log(`  wrote ${p}`)
  console.log(`Generated ${report.written.length} file(s) from ${tables.length} tables + ${routes.length} routes (orm=${orm}).`)
}
