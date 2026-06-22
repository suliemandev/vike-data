// The /account PAGE, shipped by the extension (config.pages). Shows the signed-in
// user (resolved by the vike-auth server tier into pageContext.user) with a logout
// control, or a prompt to sign in. Reads one field via useUser(); never touches
// sessions/tokens.
import { useUser } from './useUser.js'
import { UserButton } from './UserButton.jsx'
import { useTranslation } from 'vike-react-i18n'

const card = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius, 10px)',
  padding: 'var(--space-lg, 1.5rem)',
  marginTop: 'var(--space-md, 1rem)',
}
const row = { display: 'flex', gap: '0.5rem', fontSize: 14, lineHeight: 1.9 }
const label = { color: 'var(--color-muted)', minWidth: 110 }

export default function AccountPage() {
  const user = useUser()
  const { t } = useTranslation()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{t('auth.accountTitle')}</h1>
        <UserButton />
      </div>

      {user ? (
        <div style={card}>
          <div style={row}>
            <span style={label}>{t('auth.accountSignedInAs')}</span>
            <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>
          </div>
          {user.name && (
            <div style={row}>
              <span style={label}>{t('auth.accountName')}</span>
              <span style={{ color: 'var(--color-text)' }}>{user.name}</span>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--color-muted)', marginTop: 'var(--space-md, 1rem)' }}>
          {t('auth.accountSignedOut')}{' '}
          <a href="/login" style={{ color: 'var(--color-primary)' }}>
            {t('auth.signInShort')}
          </a>
        </p>
      )}
    </div>
  )
}
