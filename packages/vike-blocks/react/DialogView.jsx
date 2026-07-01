// The React renderer for the `dialog` block. Theme-native (vike-themes CSS vars), dep-free: it does
// itself what Animate UI leans on Base UI for — a portal (createPortal to <body>), a backdrop, a
// focus trap (Tab cycles inside the popup), Escape + backdrop-click to close, and body scroll-lock —
// with a CSS enter/exit (backdrop fades, popup fades + scales). Open/close is local UI state. The
// body/footer resolved sections are drawn with <Blocks>, so a dialog can hold any blocks.
import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Blocks } from './Blocks.jsx'
import { registerBlockRenderer } from './registry.js'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
const ENTER_MS = 300
// A springy ease with a little overshoot, so the popup lands like Animate UI's spring (pure CSS).
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export function DialogView({ title = '', description, trigger = 'Open', sections = [], footer = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const [render, setRender] = useState(defaultOpen) // in the DOM (kept during the exit transition)
  const [visible, setVisible] = useState(false) // drives the enter/exit CSS
  const [mounted, setMounted] = useState(false) // client only — the portal target exists after mount
  const popupRef = useRef(null)
  const lastFocused = useRef(null)
  const exitTimer = useRef(null)
  const titleId = useId()

  useEffect(() => setMounted(true), [])
  useEffect(() => () => exitTimer.current && clearTimeout(exitTimer.current), [])

  // Mount on open (cancelling a pending exit if the user reopens mid-close); on close, animate out
  // then unmount after the transition.
  useEffect(() => {
    if (open) {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current)
        exitTimer.current = null
      }
      if (typeof document !== 'undefined') lastFocused.current = document.activeElement
      setRender(true)
    } else if (render) {
      setVisible(false)
      exitTimer.current = setTimeout(() => setRender(false), ENTER_MS)
    }
  }, [open])

  // Run the ENTER transition: force the browser to paint the hidden "from" frame (a reflow), THEN
  // flip to visible on the next frame — otherwise mount + visible land in one frame and there is no
  // start state to animate from (which is why only the exit was animating).
  useEffect(() => {
    if (!render || !open || !popupRef.current) return
    void popupRef.current.getBoundingClientRect() // paint the hidden frame
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [render, open])

  // While mounted: trap Tab inside the popup, close on Escape, and lock body scroll.
  useEffect(() => {
    if (!render) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !popupRef.current) return
      const nodes = Array.from(popupRef.current.querySelectorAll(FOCUSABLE))
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [render])

  // Move focus into the popup on open; restore it to the trigger on close.
  useEffect(() => {
    if (render && popupRef.current) {
      const first = popupRef.current.querySelector(FOCUSABLE)
      ;(first ?? popupRef.current).focus()
    } else if (!render && lastFocused.current) {
      lastFocused.current.focus?.()
      lastFocused.current = null
    }
  }, [render])

  const overlay = (
    <div
      role="presentation"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.5)',
        opacity: visible ? 1 : 0,
        transition: `opacity ${ENTER_MS}ms ease`,
      }}
    >
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '1.25rem',
          background: 'var(--color-bg, #ffffff)',
          color: 'var(--color-text, #0f172a)',
          borderRadius: 'var(--radius, 12px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          opacity: visible ? 1 : 0,
          filter: visible ? 'blur(0px)' : 'blur(4px)',
          // A 3D flip in from the top + scale, matching Animate UI's signature enter/exit.
          transform: visible ? 'perspective(500px) rotateX(0deg) scale(1)' : 'perspective(500px) rotateX(-20deg) scale(0.9)',
          transition: `opacity ${ENTER_MS}ms ease, filter ${ENTER_MS}ms ease, transform ${ENTER_MS}ms ${SPRING}`,
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {title}
            </h2>
            {description && <p style={{ margin: '0.25rem 0 0', fontSize: 14, color: 'var(--color-muted, #64748b)' }}>{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            style={{ flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--color-muted, #64748b)' }}
          >
            {'×'}
          </button>
        </header>
        {sections.length > 0 && (
          <div style={{ marginTop: '0.85rem' }}>
            <Blocks sections={sections} />
          </div>
        )}
        {footer.length > 0 && (
          // A dialog footer is dismiss actions: clicking any footer button closes the dialog (a
          // button that also mutates data is the actions axis, #385). A footer link still navigates.
          <div
            onClick={(e) => {
              if (e.target.closest('button')) setOpen(false)
            }}
            style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}
          >
            <Blocks sections={footer} />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-block',
          padding: '0.5rem 0.9rem',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: 'var(--radius, 8px)',
          background: 'var(--color-surface, #f1f5f9)',
          color: 'var(--color-text, #0f172a)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {trigger}
      </button>
      {mounted && render && createPortal(overlay, document.body)}
    </>
  )
}

registerBlockRenderer('dialog', DialogView)
