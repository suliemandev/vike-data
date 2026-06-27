// Topbar app shell — signed-in chrome with horizontal nav across the top, a logo
// on the leading side and the user menu on the trailing side, content below.
import { NavList } from './NavList.jsx'

export function TopbarShell({ layout = { dir: 'ltr', slots: {} }, children }) {
  const { logo, nav, userMenu, footer } = layout.slots || {}
  // A nav item with `end: true` aligns to the trailing side, next to the user menu
  // (#303) — Account / Login sit on the right instead of crammed in with Home/Admin.
  // Items without the flag keep their place on the leading side, so an app that sets
  // no `end` is unchanged.
  const items = nav || []
  const startNav = items.filter((i) => !i.end)
  const endNav = items.filter((i) => i.end)
  return (
    <div
      dir={layout.dir}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-lg, 2rem)',
          padding: 'var(--space-md, 1rem) var(--space-lg, 2rem)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg, 2rem)' }}>
          {logo && <strong>{logo}</strong>}
          <NavList items={startNav} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg, 2rem)' }}>
          {endNav.length > 0 && <NavList items={endNav} />}
          {userMenu}
        </div>
      </header>
      <main style={{ flex: 1, padding: 'var(--space-lg, 2rem)' }}>{children}</main>
      {footer?.length > 0 && (
        <footer style={{ padding: 'var(--space-md, 1rem) var(--space-lg, 2rem)', borderTop: '1px solid var(--color-border)' }}>
          <NavList items={footer} />
        </footer>
      )}
    </div>
  )
}
