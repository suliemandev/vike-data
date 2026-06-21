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
import { mergeSchemas, generateArtifacts, resolveSchemas } from '@vike-data/vike-schema/schema'
import vikeSchema from '@vike-data/vike-schema/config'
import authExt from 'vike-auth/config'
import teamsExt from 'vike-teams/config'
import billingSchemas from 'vike-billing/schemas'

// The resolved config the build hook would see. Here it's just the billing option
// (BILLING_SUBJECT mirrors VIKE_DATA_ORM). A real vike-schema build hook reads this
// from Vike's resolved config graph; the spike supplies it directly.
const resolvedConfig = {
  billingSubject: process.env.BILLING_SUBJECT === 'user' ? 'user' : 'organization',
}

// Collect the cumulative `schemas` contributions in order. Static arrays from
// auth/teams; billing's is a function (computed from resolvedConfig) — exactly the
// shape Vike delivers it as. resolveSchemas normalizes both into a fragment list.
const contributions = [vikeSchema.schemas, authExt.schemas, teamsExt.schemas, billingSchemas]
const fragments = resolveSchemas(contributions, resolvedConfig)
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
