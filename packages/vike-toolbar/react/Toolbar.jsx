// The toolbar surface: a fixed Vike-logo button that toggles a panel of settings.
// It renders into the `bodyHtmlEnd` mount node (`#vike-toolbar-root`, outside the
// hydration root), which is why portaling extension controls into it is safe — no
// React root hydrates that subtree.
//
// The panel holds two kinds of control:
//   - simple `toolbarItems` the toolbar renders itself (context-free), and
//   - `#vike-toolbar-items`: the teleport target other extensions portal their own LIVE
//     controls into (vike-themes' picker, vike-i18n's switcher), so each keeps its
//     provider context. React renders this node empty and never reconciles its children,
//     so the externally-teleported nodes are left intact across open/close re-renders.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePortalTarget } from './usePortalTarget.js'
import logoUrl from './vike-logo.svg'

const ROOT_ID = 'vike-toolbar-root'

const panelStyle = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  insetInlineStart: 0,
  minWidth: 220,
  flexDirection: 'column',
  gap: 12,
  padding: '0.75rem 0.85rem',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
}

export function Toolbar({ items = [] }) {
  const root = usePortalTarget(ROOT_ID)
  const [open, setOpen] = useState(false)
  if (!root) return null // server + until the bodyHtmlEnd node resolves client-side

  return createPortal(
    <div style={{ position: 'fixed', bottom: 16, insetInlineStart: 16, zIndex: 50, fontFamily: 'var(--font-sans)' }}>
      <div role="dialog" aria-label="Settings" style={{ ...panelStyle, display: open ? 'flex' : 'none' }}>
        {items.map(({ id, label, Control }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            {label && <span style={{ color: 'var(--color-muted)' }}>{label}</span>}
            <Control />
          </div>
        ))}
        {/* Teleport target for other extensions' live controls. Rendered empty + with
            display:contents so its (externally-portaled) children flow into the panel. */}
        <div id="vike-toolbar-items" style={{ display: 'contents' }} />
      </div>
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          padding: 0,
          borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          cursor: 'pointer',
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
        }}
      >
        <img src={logoUrl} alt="" width="24" height="24" style={{ display: 'block' }} />
      </button>
    </div>,
    root,
  )
}
