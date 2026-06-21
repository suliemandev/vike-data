// Centered / blank shell — the public + auth shell (#25): logo + a centered card,
// no app nav. This is the bridge to vike-react-auth's login page. Authored
// entirely against the theme's CSS variables (vike-themes), so a theme swap
// restyles it without this component knowing which theme is active.
export function CenteredShell({ layout = { dir: 'ltr', slots: {} }, children }) {
  return (
    <div
      dir={layout.dir}
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-sans)',
        padding: 'var(--space-lg, 2rem)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        {layout.slots?.logo && (
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg, 2rem)', fontWeight: 700, fontSize: 20 }}>
            {layout.slots.logo}
          </div>
        )}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius, 10px)',
            padding: 'var(--space-lg, 2rem)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
