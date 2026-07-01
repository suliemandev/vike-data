// The catalog landing: a gallery of the built-in blocks, each linking to its demo page. This page
// is plain app chrome (not composed of blocks) — a directory into the demos.
const catalog = [
  { name: 'Tabs', href: '/tabs', tag: 'interactive', desc: 'Tabs with a sliding highlight and animated panels. Each panel composes other blocks.' },
  { name: 'Accordion', href: '/accordion', tag: 'interactive', desc: 'Expand/collapse sections with an animated height morph. Single or multi-open; each panel composes other blocks.' },
  { name: 'Dialog', href: '/dialog', tag: 'interactive', desc: 'A modal overlay with a portal, focus trap, Escape / outside-click, and scroll-lock. Dep-free; holds nested blocks.' },
  { name: 'Card', href: '/card', tag: 'container', desc: 'A bordered surface with an optional header + footer, wrapping nested blocks. The most-used building block; cards compose recursively.' },
  { name: 'Headings', href: '/heading', tag: 'leaf', desc: 'Six levels (h1-h6) with level-scaled top spacing, so sections breathe. Theme-native text color.' },
  { name: 'Alert', href: '/alert', tag: 'leaf', desc: 'A tone-styled notice — info / success / warning / danger. Theme-native accent + tint, dep-free.' },
  { name: 'Button', href: '/button', tag: 'leaf', desc: 'Themed buttons — primary / secondary / ghost / danger, two sizes, optional nav.' },
  { name: 'Primitives', href: '/primitives', tag: 'leaf', desc: 'heading · text · badge · divider · link — the built-in leaf blocks, composed with definePage.' },
  { name: 'Custom blocks', href: '/raw', tag: 'extend', desc: 'Define your own with defineBlock, or author a page as plain { block, ...props } descriptors.' },
]

export default function CatalogPage() {
  return (
    <div style={{ maxWidth: 860, margin: '3rem auto', padding: '0 1.25rem', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <style>{'.vb-card{transition:border-color .15s ease, transform .15s ease}.vb-card:hover{border-color:#2563eb;transform:translateY(-2px)}'}</style>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 30, margin: '0 0 0.4rem' }}>vike-blocks</h1>
        <p style={{ color: '#64748b', fontSize: 16, margin: 0, lineHeight: 1.5 }}>
          Composable UI as data — a page is a composition of blocks. Browse the built-in catalog:
        </p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {catalog.map((c) => (
          <a
            key={c.href}
            href={c.href}
            className="vb-card"
            style={{ display: 'block', textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.1rem 1.2rem', background: '#fff' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontSize: 11, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 999, padding: '1px 8px' }}>{c.tag}</span>
            </div>
            <p style={{ margin: '0 0 0.85rem', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{c.desc}</p>
            <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>View demo -&gt;</span>
          </a>
        ))}
      </div>
    </div>
  )
}
