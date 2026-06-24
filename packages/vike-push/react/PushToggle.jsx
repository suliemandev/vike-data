// <PushToggle> - the React subscribe control. A button that enables/disables Web Push
// notifications for the signed-in user. Thin wrapper over the framework-agnostic client
// helpers (vike-push/client); imports nothing server-side.
//
// The VAPID public key comes from the `vapidPublicKey` prop, or the app's
// `vapidPublicKey` config off pageContext (declared in vike-push/config). The service
// worker URL defaults to /vike-push-sw.js (served from the app's public/).
import { useState, useEffect } from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { isPushSupported, subscribe, unsubscribe, getExistingSubscription } from '../client.js'

export function PushToggle({ vapidPublicKey, swUrl = '/vike-push-sw.js', label = 'Notifications' }) {
  const pageContext = usePageContext()
  const key = vapidPublicKey || pageContext?.config?.vapidPublicKey
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setSupported(isPushSupported())
    getExistingSubscription().then((s) => setSubscribed(!!s)).catch(() => {})
  }, [])

  if (!supported) {
    return <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Push not supported here</span>
  }

  async function onClick() {
    setBusy(true)
    setError(null)
    try {
      if (subscribed) {
        await unsubscribe({})
        setSubscribed(false)
      } else {
        await subscribe({ vapidPublicKey: key, swUrl })
        setSubscribed(true)
      }
    } catch (e) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          padding: '0.35rem 0.7rem',
          borderRadius: 'var(--radius, 10px)',
          border: '1px solid var(--color-border)',
          background: subscribed ? 'var(--color-surface)' : 'var(--color-primary)',
          color: subscribed ? 'var(--color-text)' : 'var(--color-primary-text, #fff)',
          fontSize: 13,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? '...' : subscribed ? `Disable ${label}` : `Enable ${label}`}
      </button>
      {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
    </span>
  )
}

export default PushToggle
