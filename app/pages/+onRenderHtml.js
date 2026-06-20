// Consumer for BOTH spikes:
//
//  Spike 1 (wiring): the host's cumulative `migrations` config collected
//  contributions from every extension + the app. (Recap section.)
//
//  Spike 2 (ORM-agnostic schema): each extension defines its tables ONCE in the
//  neutral DSL (vike-data/schema). The data layer compiles them to whichever ORM
//  the app selected (VIKE_DATA_ORM env var). We render all three so you can see the
//  single definition becoming Prisma + Drizzle + native side by side.
import { escapeInject, dangerouslySkipEscape } from 'vike/server'
import { COMPILERS } from 'vike-data/schema'
import authSchemas from 'example-auth/schema'
import billingSchemas from 'example-billing/schema'

const ORMS = ['prisma', 'drizzle', 'native']
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function onRenderHtml(pageContext) {
  const selected = (process.env.VIKE_DATA_ORM || 'drizzle').toLowerCase()

  // --- Spike 1 recap: merged contributions from the cumulative config --------
  const migrations = (pageContext.config.migrations || []).flat().sort((a, b) => a.localeCompare(b))
  const migrationRows = migrations.map((m) => `<li><code>${escapeHtml(m)}</code></li>`).join('')

  // --- Spike 2: one neutral schema -> three ORMs -----------------------------
  const schemas = [...authSchemas, ...billingSchemas]
  const schemaBlocks = schemas.map((ir) => {
    const cards = ORMS.map((orm) => {
      const code = COMPILERS[orm](ir)
      const sel = orm === selected
      return `
        <div style="border:1px solid ${sel ? '#0a7' : '#ddd'}; border-radius:6px; padding:.5rem .75rem; background:${sel ? '#f2fbf7' : '#fff'};">
          <div style="font-weight:bold; color:${sel ? '#0a7' : '#999'};">${orm}${sel ? ' &larr; selected, gets applied' : ''}</div>
          <pre style="margin:.4rem 0 0; white-space:pre-wrap; font-size:12px;">${escapeHtml(code)}</pre>
        </div>`
    }).join('')
    return `
      <section>
        <h3 style="margin-bottom:.3rem;"><code>${ir.table}</code> &mdash; ${String(ir.columns.length)} columns, defined once</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:.6rem;">${cards}</div>
      </section>`
  }).join('')

  const doc = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Vike data-layer spikes</title></head>
  <body style="font-family: ui-monospace, monospace; max-width: 1100px; margin: 2.5rem auto; line-height:1.5; color:#222;">
    <h1>Vike data-layer spikes</h1>

    <h2>1. Inter-extension contribution (wiring)</h2>
    <p>${String(migrations.length)} migrations collected via the host's cumulative config, from the host + both extensions + the app. No side-channel global.</p>
    <ol>${migrationRows}</ol>

    <h2 style="margin-top:2rem;">2. One schema definition &rarr; any ORM</h2>
    <p>Selected ORM: <strong>${escapeHtml(selected)}</strong> (set <code>VIKE_DATA_ORM=prisma|drizzle|native</code>). Each table below is authored once by its extension in the neutral DSL, then compiled to all three.</p>
    ${schemaBlocks}
  </body>
</html>`

  return escapeInject`${dangerouslySkipEscape(doc)}`
}
