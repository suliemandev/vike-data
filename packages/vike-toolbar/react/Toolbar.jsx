// The interactive toolbar: a fixed logo button that toggles a popover listing the
// composed settings. Each item renders its own `Control` (the per-framework control a
// contributing extension advertised) under an optional `label`. Styled against the
// theme vars so it inherits the active brand/appearance like the rest of the chrome.
//
// Client-interactive (useState for open/closed); it SSRs closed and becomes live after
// hydration. Positioned bottom-left (inset-inline-start, so it flips under RTL).
import { useState } from 'react'

const LOGO = '◆' // the Vike-logo button glyph; an app can swap the control set, not this.

export function Toolbar({ items = [] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'fixed', bottom: 16, insetInlineStart: 16, zIndex: 50, fontFamily: 'var(--font-sans)' }}>
      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            insetInlineStart: 0,
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '0.7rem 0.8rem',
            borderRadius: 'var(--radius, 10px)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 13,
            boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
          }}
        >
          {items.map(({ id, label, Control }) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {label && <span style={{ color: 'var(--color-muted)' }}>{label}</span>}
              <Control />
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          fontSize: 18,
          cursor: 'pointer',
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
        }}
      >
        {LOGO}
      </button>
    </div>
  )
}
