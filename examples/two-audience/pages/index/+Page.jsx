// Home: just content. The topbar shell (logo + nav) comes from the app's `layout`
// config via vike-layouts/react; the theme from vike-themes/react. The page resolves
// the current session through vike-auth's useUser hook — the single (default user)
// audience that Phase 1 will split into staff + customer guards.
import { UserButton } from 'vike-auth/react/UserButton'
import { useUser } from 'vike-auth/react/hooks'

export default function HomePage() {
  const user = useUser()
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <UserButton />
      </div>
      <h1 style={{ marginTop: 0 }}>Two-audience reference app</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Phase 0 skeleton: a single audience (vike-auth's default user guard) on the memory
        adapter. Phase 1 splits this into two guards (staff + customer), each with its own
        login and session.
      </p>
      {user ? (
        <p style={{ color: 'var(--color-muted)' }}>
          Signed in as <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>.
        </p>
      ) : (
        <p style={{ color: 'var(--color-muted)' }}>
          You are signed out.{' '}
          <a href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</a>{' '}
          to see the session resolve.
        </p>
      )}
    </div>
  )
}
