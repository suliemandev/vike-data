// Home: just content. The topbar shell (logo + nav) comes from the app's `layout` config via
// vike-layouts/react; the theme from vike-themes/react. The UserButton + useUser come from
// vike-auth, reading the signed-in user the auth tier put on pageContext -- now backed by rows in
// Postgres rather than the in-memory store.
import { UserButton } from 'vike-auth/react/UserButton'
import { useUser } from 'vike-auth/react/hooks'

export default function HomePage() {
  const user = useUser()
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <UserButton />
      </div>
      <h1 style={{ marginTop: 0 }}>vike-data on a real database</h1>
      {user ? (
        <p style={{ color: 'var(--color-muted)' }}>
          Signed in as <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>.
        </p>
      ) : (
        <p style={{ color: 'var(--color-muted)' }}>
          You are signed out.{' '}
          <a href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</a> with a magic link
          (printed to the dev console).
        </p>
      )}
      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.7 }}>
        This is the persistent-Postgres twin of <code>examples/react</code>: the same admin, auth
        and rbac app, but on <code>vike-drizzle</code> + an embedded Postgres (pglite). The only
        difference is the adapter wiring and the <code>db/</code> migration + seed scripts. Visit{' '}
        <a href="/admin" style={{ color: 'var(--color-primary)' }}>/admin</a> to browse the seeded
        users, then restart the server -- the rows are still there.
      </p>
    </div>
  )
}
