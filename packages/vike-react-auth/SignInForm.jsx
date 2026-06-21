// <SignInForm> — posts an email to the vike-auth server tier's /auth/request
// endpoint and shows the "check your inbox" state. Styled entirely with the
// theme's CSS variables (vike-themes), so installing a theme restyles it — the
// login page is exactly issue #24's first theme consumer.
import { useState } from 'react'

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

export function SignInForm({ action = '/auth/request', heading = 'Sign in' }) {
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
        <h1 style={{ margin: '0 0 0.5rem', fontSize: 20 }}>Check your inbox</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.6 }}>
          We sent a sign-in link to <strong style={{ color: 'var(--color-text)' }}>{email}</strong>.
          In dev no email is sent — the magic link is printed in the server console.
        </p>
        <button type="button" style={{ ...primaryBtn, background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }} onClick={() => setState('idle')}>
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: 20 }}>{heading}</h1>
      <p style={{ margin: '0 0 var(--space-lg, 1.5rem)', color: 'var(--color-muted)', fontSize: 14 }}>
        Passwordless — we email you a one-time link.
      </p>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--color-muted)' }}>
        Email
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
        {state === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {state === 'error' && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 'var(--space-md, 1rem)' }}>Something went wrong. Please try again.</p>
      )}
      <p style={{ marginTop: 'var(--space-lg, 1.5rem)', color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5 }}>
        Served by the <code>vike-auth</code> extension — sessions are backed by the <code>sessions</code> table it declares.
      </p>
    </form>
  )
}
