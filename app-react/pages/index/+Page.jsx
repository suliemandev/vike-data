// Home: just content. The topbar shell (logo + nav) comes from the app's `layout`
// config via vike-react-layouts; the theme from vike-themes/react; the strings from
// vike-react-i18n (app keys here, auth keys from the extension). All composed.
import { UserButton, useUser } from 'vike-react-auth'
import { useTranslation } from 'vike-react-i18n'

export default function HomePage() {
  const user = useUser()
  const { t } = useTranslation()
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <UserButton />
      </div>
      <h1 style={{ marginTop: 0 }}>{t('app.homeTitle')}</h1>
      {user ? (
        <p style={{ color: 'var(--color-muted)' }}>
          {t('app.signedInAs')} <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>.
        </p>
      ) : (
        <p style={{ color: 'var(--color-muted)' }}>
          {t('app.signedOut')}{' '}
          <a href="/login" style={{ color: 'var(--color-primary)' }}>{t('auth.signInShort')}</a>{' '}
          {t('app.signInPrompt')}
        </p>
      )}
      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.7 }}>{t('app.blurb')}</p>
    </div>
  )
}
