// The toolbar surface: a fixed Vike-logo button that toggles a panel of settings.
//
// The BUTTON renders in-tree (server-rendered + hydrated) so it's in the initial HTML
// and never pops in after hydration — no flash on a full page load or a full-reload
// navigation. The PANEL is portaled into the `bodyHtmlEnd` mount node
// (`#vike-toolbar-root`, OUTSIDE the framework hydration root): that's what makes it
// safe for OTHER extensions to teleport their live controls into `#vike-toolbar-items`
// (no React root reconciles that subtree, so the teleported nodes are left intact).
// Button and panel are both `position: fixed`, so their separate DOM locations don't
// matter visually; the shared `open` state flows from the button through the portal.
//
// The panel holds two kinds of control: simple `toolbarItems` the toolbar renders
// itself (context-free), and `#vike-toolbar-items`, the teleport target for extensions'
// own LIVE controls (vike-themes' picker, vike-i18n's switcher).
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePortalTarget } from './usePortalTarget.js'
// Inline the logo as raw SVG markup, not an <img src>: an <img> re-decodes the file
// whenever React re-creates the element, which can blink the icon. Inlined DOM never
// reloads, so the button stays rock-steady.
import logoSvg from './vike-logo.svg?raw'

// Size the root <svg> down to the button (it ships at 38x38); the viewBox keeps it crisp.
const logoMarkup = logoSvg.replace('width="38"', 'width="24"').replace('height="38"', 'height="24"')

const ROOT_ID = 'vike-toolbar-root'
const FIXED = { position: 'fixed', insetInlineStart: 16, zIndex: 50, fontFamily: 'var(--font-sans)' }

const panelStyle = {
  ...FIXED,
  bottom: 72, // sits just above the 44px button (bottom:16) + gap
  minWidth: 220,
  flexDirection: 'column',
  gap: 12,
  padding: '0.75rem 0.85rem',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 13,
  boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
}

export function Toolbar({ items = [] }) {
  const root = usePortalTarget(ROOT_ID)
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Panel: portaled into the out-of-hydration bodyHtmlEnd node (client-only). It's
          hidden until opened, so its post-hydration arrival is never visible. */}
      {root &&
        createPortal(
          <div role="dialog" aria-label="Settings" style={{ ...panelStyle, display: open ? 'flex' : 'none' }}>
            {items.map(({ id, label, Control }) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                {label && <span style={{ color: 'var(--color-muted)' }}>{label}</span>}
                <Control />
              </div>
            ))}
            {/* Teleport target for other extensions' live controls. Empty + display:contents
                so its (externally-portaled) children flow into the panel's column. */}
            <div id="vike-toolbar-items" style={{ display: 'contents' }} />
          </div>,
          root,
        )}

      {/* Button: in-tree, so it's server-rendered and present from first paint. */}
      <button
        type="button"
        aria-label="Open settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...FIXED,
          bottom: 16,
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
        <span
          aria-hidden="true"
          style={{ display: 'flex', width: 24, height: 24 }}
          dangerouslySetInnerHTML={{ __html: logoMarkup }}
        />
      </button>
    </>
  )
}
