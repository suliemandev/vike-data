// /admin — the dashboard. Renders one card per resource this install composed (the
// union of every extension's contributions), filtered server-side to what the signed-in
// user may view. Pure presentation: the data hook (vike-admin/data:dashboardData) did
// the resolving; this reads the view-model via useData().
import { useData } from 'vike-react/useData'

const card = {
  display: 'block',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius, 10px)',
  padding: 'var(--space-md, 1rem) var(--space-lg, 1.5rem)',
  textDecoration: 'none',
  color: 'var(--color-text)',
}

export default function DashboardPage() {
  const { resources } = useData()
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>Admin</h1>
      {resources.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No resources have been contributed yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md, 1rem)' }}>
          {resources.map((r) => (
            <a key={r.table} href={`/admin/${r.table}`} style={card}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{r.label}</div>
              <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 4 }}>
                <code>{r.table}</code>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
