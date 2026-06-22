// <SignInForm> — posts an email to the vike-auth server tier's /auth/request
// endpoint and shows the "check your inbox" state. Styled with the theme's CSS
// variables (vike-themes) and localized via vike-i18n/react: every string is a
// t() lookup keyed under `auth.*`, and vike-auth/react ships the translations
// (see ./messages.js + +config.js), so the login UI follows the active locale.
import { useState } from 'react'
import { useTranslation } from 'vike-i18n/react/hooks'

const field = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.7rem',
  marginTop: '0.35rem',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: 14,
}

const primaryBtn = {
  width: '100%',
  marginTop: 'var(--space-md, 1rem)',
  padding: '0.6rem 0.7rem',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid transparent',
  background: 'var(--color-primary)',
  color: 'var(--color-primary-text)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}

export function SignInForm({ action = '/auth/request', appName = 'Acme' }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error

  async function onSubmit(e) {
    e.preventDefault()
    setState('sending')
    try {
      const body = new FormData()
      body.set('email', email)
      const res = await fetch(action, { method: 'POST', body })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: 20 }}>{t('auth.inboxTitle')}</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.6 }}>
          {t('auth.inboxBody', { email })} {t('auth.devNote')}
        </p>
        <button type="button" style={{ ...primaryBtn, background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }} onClick={() => setState('idle')}>
          {t('auth.different')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: 20 }}>{t('auth.signIn', { app: appName })}</h1>
      <p style={{ margin: '0 0 var(--space-lg, 1.5rem)', color: 'var(--color-muted)', fontSize: 14 }}>
        {t('auth.subtitle')}
      </p>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--color-muted)' }}>
        {t('auth.email')}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          style={field}
        />
      </label>
      <button type="submit" disabled={state === 'sending'} style={{ ...primaryBtn, opacity: state === 'sending' ? 0.7 : 1 }}>
        {state === 'sending' ? t('auth.sending') : t('auth.send')}
      </button>
      {state === 'error' && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 'var(--space-md, 1rem)' }}>{t('auth.error')}</p>
      )}
      <p style={{ marginTop: 'var(--space-lg, 1.5rem)', color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5 }}>
        {t('auth.footer')}
      </p>
    </form>
  )
}
