// Home: the composition proof. It resolves THREE independent audiences side by side — the
// default user guard (vike-auth's `pageContext.user`) and the two named guards (#267,
// `pageContext.guards.admin.user` / `.client.user`) — each from its own cookie, with no
// cross-talk. Sign into the staff and client guards in the same browser and both show as
// signed in; log one out and the other is untouched.
import { usePageContext } from 'vike-react/usePageContext'

const card = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius, 10px)',
  padding: 'var(--space-md, 1rem)',
  marginTop: '0.75rem',
}

function GuardCard({ title, user, loginHref, logoutAction }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <strong style={{ color: 'var(--color-text)' }}>{title}</strong>
        {user ? (
          <form method="post" action={logoutAction} style={{ margin: 0 }}>
            <button
              type="submit"
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius, 8px)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Log out
            </button>
          </form>
        ) : (
          <a href={loginHref} style={{ color: 'var(--color-primary)', fontSize: 14, fontWeight: 600 }}>
            Sign in
          </a>
        )}
      </div>
      <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)', fontSize: 14 }}>
        {user ? (
          <>Signed in as <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>.</>
        ) : (
          'Not signed in.'
        )}
      </p>
    </div>
  )
}

export default function HomePage() {
  const pageContext = usePageContext()
  const guards = pageContext.guards || {}
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Two-audience reference app</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Three independent audiences resolve side by side, each from its own session cookie.
        Sign into staff and client in the same browser: both stay signed in, and logging one
        out leaves the other alone.
      </p>

      <GuardCard
        title="Staff (admin guard)"
        user={guards.admin?.user}
        loginHref="/admin/login"
        logoutAction="/admin-auth/logout"
      />
      <GuardCard
        title="Client guard"
        user={guards.client?.user}
        loginHref="/client/login"
        logoutAction="/client-auth/logout"
      />
      <GuardCard
        title="Default user guard"
        user={pageContext.user}
        loginHref="/login"
        logoutAction="/auth/logout"
      />

      <p style={{ color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.7, marginTop: '1.5rem' }}>
        Seeded sign-ins (magic link printed to the dev console): staff{' '}
        <code>boss@example.com</code>, client <code>customer@example.com</code>, default user{' '}
        <code>ada@example.com</code>.
      </p>
    </div>
  )
}
