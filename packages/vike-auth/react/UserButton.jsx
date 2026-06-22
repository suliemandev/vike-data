// <UserButton> — shows the signed-in user and a logout control, or a sign-in link
// when logged out. Reads useUser() (pageContext.user from the server tier); logout
// is a real POST to /auth/logout (the server tier destroys the session row).
import { useUser } from './useUser.js'
import { useTranslation } from 'vike-i18n/react/hooks'
import { authMessages } from './messages.js'

export function UserButton({ loginHref = '/login' }) {
  const user = useUser()
  const { t } = useTranslation(authMessages.en)

  if (!user) {
    return (
      <a href={loginHref} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
        {t('auth.signInShort')}
      </a>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md, 1rem)' }}>
      <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>{user.name || user.email}</span>
      <form method="post" action="/auth/logout" style={{ margin: 0 }}>
        <button
          type="submit"
          style={{
            padding: '0.35rem 0.7rem',
            borderRadius: 'var(--radius, 10px)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {t('auth.logout')}
        </button>
      </form>
    </div>
  )
}
