// `vike-data` generation entry — the Prisma-style explicit command.
//
// It mirrors what a real vike-schema build hook would do automatically by reading
// Vike's resolved config graph. For the spike we import the extension configs
// directly (the same modules `pages/+config.js` installs), collect their schema
// fragments in contribution order, merge them, and write the per-ORM artifacts to
// disk at their conventional paths.
//
//   pnpm gen            # uses VIKE_DATA_ORM (defaults to drizzle)
//   pnpm gen:prisma     # or gen:drizzle / gen:native
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { mergeSchemas, generateArtifacts } from '@vike-data/vike-schema/schema'
import vikeSchema from '@vike-data/vike-schema/config'
import authExt from 'vike-auth/config'
import teamsExt from 'vike-teams/config'
import { billingFor } from 'vike-billing/billing'

// vike-billing is parameterized: BILLING_SUBJECT picks what it bills against. The
// codegen driver is plain JS, so unlike Vike's `extends` it CAN call the factory.
const subject = process.env.BILLING_SUBJECT === 'user' ? 'user' : 'organization'

// Contribution order: vike-schema's own `_migrations` first (each extension
// self-installs it), then the feature extensions in dependency order (auth before
// teams, since teams references + extends auth's `users`; billing references
// whichever subject it bills against).
const installed = [vikeSchema, authExt, teamsExt, billingFor(subject)]
const fragments = installed.flatMap((c) => c.schemas || []).flat()
const { tables, conflicts } = mergeSchemas(fragments)

if (conflicts.length) {
  console.error(`Refusing to generate: ${conflicts.length} schema conflict(s):`)
  for (const c of conflicts) console.error(`  - ${c.kind}: ${c.table}${c.column ? '.' + c.column : ''}`)
  process.exit(1)
}

const orm = (process.env.VIKE_DATA_ORM || 'drizzle').toLowerCase()
const files = generateArtifacts({ tables, fragments }, orm)

for (const f of files) {
  const abs = join(process.cwd(), f.path)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, f.contents)
  console.log(`  wrote ${f.path}`)
}
console.log(`Generated ${files.length} ${orm} artifact(s) from ${tables.length} merged tables.`)
