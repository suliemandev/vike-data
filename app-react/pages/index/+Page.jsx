// Home: just content. The topbar shell (logo + nav) comes from the app's `layout`
// config via vike-layouts/react; the theme from vike-themes/react; the strings from
// vike-i18n/react (app keys here, auth keys from the extension). All composed.
import { UserButton } from 'vike-auth/react/UserButton'
import { useUser } from 'vike-auth/react/hooks'
import { useTranslation } from 'vike-i18n/react/hooks'

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
