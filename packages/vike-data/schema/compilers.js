// Per-ORM compilers. Each takes the same neutral IR (from defineSchema) and
// emits that ORM's schema artifact. Representative output for a spike, not a
// production-grade generator: enough to prove "define once, target any ORM".

const pascal = (s) => s.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

// ---------------------------------------------------------------- Prisma -----
function prismaType(c) {
  const base = { uuid: 'String', string: 'String', text: 'String', integer: 'Int', boolean: 'Boolean', timestamp: 'DateTime' }[c.type] || 'String'
  return base + (c.nullable ? '?' : '')
}
function prismaAttrs(c) {
  const a = []
  if (c.primary) a.push('@id')
  if (c.unique) a.push('@unique')
  if (c.type === 'uuid' && c.primary && c.default === undefined) a.push('@default(uuid())')
  if (c.default === 'now') a.push('@default(now())')
  else if (typeof c.default === 'boolean') a.push(`@default(${c.default})`)
  else if (c.default !== undefined) a.push(`@default(${JSON.stringify(c.default)})`)
  if (c.type === 'text') a.push('@db.Text')
  return a.join(' ')
}
export function toPrisma(ir) {
  const rows = ir.columns.map((c) => `  ${c.name} ${prismaType(c)} ${prismaAttrs(c)}`.trimEnd())
  return `model ${pascal(ir.table)} {\n${rows.join('\n')}\n\n  @@map("${ir.table}")\n}`
}

// --------------------------------------------------------------- Drizzle -----
const DRIZZLE_FN = { uuid: 'uuid', string: 'varchar', text: 'text', integer: 'integer', boolean: 'boolean', timestamp: 'timestamp' }
function drizzleCol(c) {
  let s
  switch (c.type) {
    case 'string': s = `varchar('${c.name}', { length: 255 })`; break
    default: s = `${DRIZZLE_FN[c.type] || 'text'}('${c.name}')`
  }
  if (c.primary) s += '.primaryKey()'
  if (c.type === 'uuid' && c.primary && c.default === undefined) s += '.defaultRandom()'
  if (!c.nullable) s += '.notNull()'
  if (c.unique) s += '.unique()'
  if (c.default === 'now') s += '.defaultNow()'
  else if (typeof c.default === 'boolean') s += `.default(${c.default})`
  else if (c.default !== undefined) s += `.default(${JSON.stringify(c.default)})`
  return `  ${camel(c.name)}: ${s},`
}
export function toDrizzle(ir) {
  const fns = [...new Set(ir.columns.map((c) => DRIZZLE_FN[c.type] || 'text'))]
  const body = ir.columns.map(drizzleCol).join('\n')
  return `import { pgTable, ${fns.join(', ')} } from 'drizzle-orm/pg-core'\n\nexport const ${camel(ir.table)} = pgTable('${ir.table}', {\n${body}\n})`
}

// ---------------------------------------------------------------- Native -----
function nativeCol(c) {
  let s = `t.${c.type}('${c.name}')`
  if (c.primary) s += '.primary()'
  if (c.unique) s += '.unique()'
  if (c.nullable) s += '.nullable()'
  if (c.default === 'now') s += '.useCurrent()'
  else if (c.default !== undefined) s += `.default(${JSON.stringify(c.default)})`
  return `      ${s}`
}
export function toNative(ir) {
  const body = ir.columns.map(nativeCol).join('\n')
  return `import { Migration, Schema } from '@rudderjs/database'\n\nexport default class extends Migration {\n  async up() {\n    await Schema.create('${ir.table}', (t) => {\n${body}\n    })\n  }\n}`
}

export const COMPILERS = { prisma: toPrisma, drizzle: toDrizzle, native: toNative }
