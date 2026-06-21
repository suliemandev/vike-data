// Home: the topbar app shell with a <UserButton> in the user-menu slot. Shows the
// signed-in user (resolved by the vike-auth server tier into pageContext.user) or
// a prompt to sign in. Same theme + layout primitives as the login page.
import { Layout } from 'vike-react-layouts'
import { UserButton, useUser } from 'vike-react-auth'

export default function HomePage() {
  const user = useUser()
  return (
    <Layout
      shell="topbar"
      logo="◆ Acme"
      nav={[
        { label: 'Home', href: '/' },
        { label: 'Login', href: '/login' },
      ]}
      userMenu={<UserButton />}
    >
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ marginTop: 0 }}>vike-data — React UI tier</h1>
        {user ? (
          <p style={{ color: 'var(--color-muted)' }}>
            Signed in as <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>. The user button (top-right) logs you out.
          </p>
        ) : (
          <p style={{ color: 'var(--color-muted)' }}>
            You are signed out. <a href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</a> to see the session resolve.
          </p>
        )}
        <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.7 }}>
          One page, three composing extensions: <code>vike-layouts</code> picks the shell,
          <code> vike-themes</code> styles it (toggle bottom-right), <code>vike-react-auth</code> owns the auth flow.
        </p>
      </div>
    </Layout>
  )
}
