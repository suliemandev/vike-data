// The consumer: vike-schema's job, done in one place.
//
// 1. Read every schema fragment contributed through the `schemas` cumulative
//    config (from vike-schema + every extension).
// 2. Merge creates + extends into final tables (3rd-party column adds land here;
//    column edits are flagged as conflicts).
// 3. DERIVE migrations from the merged schema (not hand-authored).
// 4. Compile each table to the ORM the app picked (VIKE_DATA_ORM), shown next to
//    the other targets so the "define once, any ORM" point is visible.
import { escapeInject, dangerouslySkipEscape } from 'vike/server'
import { COMPILERS, mergeSchemas, deriveMigrations } from '@vike-data/vike-schema/schema'

const ORMS = ['prisma', 'drizzle', 'native']
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function onRenderHtml(pageContext) {
  const selected = (process.env.VIKE_DATA_ORM || 'drizzle').toLowerCase()

  const fragments = (pageContext.config.schemas || []).flat()
  const { tables, conflicts } = mergeSchemas(fragments)
  const migrations = deriveMigrations(fragments)

  const migrationRows = migrations.map((m) => `<li><code>${escapeHtml(m)}</code></li>`).join('')

  const tableBlocks = tables.map((table) => {
    const cols = table.columns
      .map((c) => {
        const badge = c.added ? ' <span style="color:#0a7;">+ added by extension</span>' : ''
        return `<li><code>${escapeHtml(c.name)}</code> <span style="color:#999;">${c.type}</span>${badge}</li>`
      })
      .join('')

    const cards = ORMS.map((orm) => {
      const code = COMPILERS[orm]({ table: table.table, columns: table.columns })
      const sel = orm === selected
      return `
        <div style="border:1px solid ${sel ? '#0a7' : '#ddd'}; border-radius:6px; padding:.5rem .75rem; background:${sel ? '#f2fbf7' : '#fff'};">
          <div style="font-weight:bold; color:${sel ? '#0a7' : '#999'};">${orm}${sel ? ' &larr; selected, gets applied' : ''}</div>
          <pre style="margin:.4rem 0 0; white-space:pre-wrap; font-size:12px;">${escapeHtml(code)}</pre>
        </div>`
    }).join('')

    return `
      <section style="margin-bottom:1.6rem;">
        <h3 style="margin-bottom:.3rem;"><code>${table.table}</code> &mdash; merged schema (${String(table.columns.length)} columns)</h3>
        <ul style="margin:.2rem 0 .7rem;">${cols}</ul>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:.6rem;">${cards}</div>
      </section>`
  }).join('')

  const conflictBlock = conflicts.length
    ? `<h2 style="color:#b00;">Conflicts (${String(conflicts.length)})</h2><ul>${conflicts
        .map((c) => `<li>${escapeHtml(c.kind)}: <code>${escapeHtml(c.table)}${c.column ? '.' + c.column : ''}</code></li>`)
        .join('')}</ul>`
    : ''

  const doc = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>vike-schema</title></head>
  <body style="font-family: ui-monospace, monospace; max-width: 1100px; margin: 2.5rem auto; line-height:1.5; color:#222;">
    <h1>vike-schema</h1>
    <p>${String(fragments.length)} schema fragments contributed through one cumulative config (vike-schema + ${String(fragments.length - 1)} from extensions), merged into ${String(tables.length)} tables. Schema is the source of truth; everything below is derived.</p>

    <h2>Derived migrations</h2>
    <p style="color:#666;">Generated from the schema in contribution order, not hand-authored.</p>
    <ol>${migrationRows}</ol>

    ${conflictBlock}

    <h2 style="margin-top:1.5rem;">Merged tables &rarr; selected ORM: <strong>${escapeHtml(selected)}</strong></h2>
    <p style="color:#666;">Each table defined once; compiled to all three (set VIKE_DATA_ORM / run pnpm dev:prisma|drizzle|native). Note <code>users</code> gets <code>stripe_customer_id</code> added by the billing extension.</p>
    ${tableBlocks}
  </body>
</html>`

  return escapeInject`${dangerouslySkipEscape(doc)}`
}
