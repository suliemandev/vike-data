// Shared nav renderer for the app shells: a list of { label, href } slot items,
// styled against the theme vars. Direction-aware via the parent shell's `dir`.
//
// Active item (#303): the link whose href matches the current page is rendered in
// full-contrast + bold with `aria-current="page"`; the rest stay muted. The MATCH
// is the framework-agnostic `isActivePath` from the core, so the React and Vue
// NavLists agree; only the styling is per-framework. The current path comes from
// vike-react's pageContext, so it tracks the server render and every client-side
// navigation with no per-page wiring.
import { usePageContext } from 'vike-react/usePageContext'
import { isActivePath } from '../../index.js'

export function NavList({ items = [], vertical = false }) {
  const pageContext = usePageContext()
  const current = pageContext?.urlPathname || ''
  return (
    <nav style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 'var(--space-md, 1rem)' }}>
      {items.map((item) => {
        const active = isActivePath(current, item.href)
        return (
          <a
            key={item.href ?? item.label}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{
              color: active ? 'var(--color-text)' : 'var(--color-muted)',
              fontWeight: active ? 600 : 400,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}
