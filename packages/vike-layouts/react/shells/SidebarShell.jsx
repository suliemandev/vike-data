// Sidebar app shell — signed-in chrome with vertical nav down the leading side
// (logo on top, user menu at the bottom), content in the main column.
import { NavList } from './NavList.jsx'

export function SidebarShell({ layout = { dir: 'ltr', slots: {} }, children }) {
  const { logo, nav, userMenu } = layout.slots || {}
  return (
    <div
      dir={layout.dir}
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg, 2rem)',
          padding: 'var(--space-lg, 2rem)',
          borderInlineEnd: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        {logo && <strong>{logo}</strong>}
        <NavList items={nav} vertical />
        <div style={{ marginTop: 'auto' }}>{userMenu}</div>
      </aside>
      <main style={{ flex: 1, padding: 'var(--space-lg, 2rem)' }}>{children}</main>
    </div>
  )
}
