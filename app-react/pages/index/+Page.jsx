// Home: just content. The topbar shell (logo + nav) comes from the app's `layout`
// config via vike-react-layouts; the theme from vike-react-themes. The page renders
// the user state + a logout button (UserButton) inside the shell's content area.
import { UserButton, useUser } from 'vike-react-auth'

export default function HomePage() {
  const user = useUser()
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <UserButton />
      </div>
      <h1 style={{ marginTop: 0 }}>vike-data — React UI tier</h1>
      {user ? (
        <p style={{ color: 'var(--color-muted)' }}>
          Signed in as <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>.
        </p>
      ) : (
        <p style={{ color: 'var(--color-muted)' }}>
          You are signed out. <a href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</a> to see the session resolve.
        </p>
      )}
      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.7 }}>
        Themes and layouts are installed and configured exactly like the other
        extensions — <code>extends</code> + a sibling config key. Switch theme with
        the picker (bottom-right); the shell comes from this page's <code>layout</code> config.
      </p>
    </div>
  )
}
