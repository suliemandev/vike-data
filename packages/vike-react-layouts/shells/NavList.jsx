// Shared nav renderer for the app shells: a list of { label, href } slot items,
// styled against the theme vars. Direction-aware via the parent shell's `dir`.
export function NavList({ items = [], vertical = false }) {
  return (
    <nav style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 'var(--space-md, 1rem)' }}>
      {items.map((item) => (
        <a
          key={item.href ?? item.label}
          href={item.href}
          style={{ color: 'var(--color-muted)', textDecoration: 'none', fontSize: 14 }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}
