// <NotificationsBell> — the React in-app feed control. A bell with an unread badge that
// opens a feed list; clicking "Mark all read" clears the badge. Thin wrapper over the
// framework-agnostic client helpers (vike-notifications/client); imports nothing
// server-side, so it is safe in the client bundle.
import { useState, useEffect, useCallback } from 'react'
import { fetchFeed, markRead } from '../client.js'

export function NotificationsBell({ label = 'Notifications', pollMs = 0 }) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const { items, unread } = await fetchFeed({})
      setItems(items)
      setUnread(unread)
      setError(null)
    } catch (e) {
      setError(e?.message || 'Failed to load')
    }
  }, [])

  useEffect(() => {
    load()
    if (!pollMs) return undefined
    const id = setInterval(load, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  async function onMarkAll() {
    try {
      await markRead(null, {})
      await load()
    } catch (e) {
      setError(e?.message || 'Failed to mark read')
    }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          padding: '0.35rem 0.6rem',
          borderRadius: 'var(--radius, 10px)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        {'\u{1F514}'}
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: '#dc2626',
              color: '#fff',
              fontSize: 10,
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            maxHeight: 380,
            overflowY: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius, 10px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 0.75rem',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>{label}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {error && <div style={{ padding: '0.6rem 0.75rem', color: '#dc2626', fontSize: 12 }}>{error}</div>}

          {items.length === 0 ? (
            <div style={{ padding: '1rem 0.75rem', color: 'var(--color-muted)', fontSize: 13 }}>Nothing yet</div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '0.6rem 0.75rem',
                  borderBottom: '1px solid var(--color-border)',
                  background: n.read ? 'transparent' : 'var(--color-primary-soft, rgba(59,130,246,0.08))',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: n.read ? 400 : 600 }}>{n.data?.title ?? n.type}</div>
                {n.data?.body && <div style={{ color: 'var(--color-muted)', marginTop: 2 }}>{n.data.body}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </span>
  )
}

export default NotificationsBell
