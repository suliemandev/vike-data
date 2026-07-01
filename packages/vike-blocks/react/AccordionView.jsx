// The React renderer for the `accordion` block. Theme-native: every color / radius reads a
// vike-themes CSS variable (with a fallback), so a theme restyles it for free. Which items are open
// is local UI state; single-open mode closes the others on open (both modes are collapsible — the
// open item toggles shut). Each panel morphs its height between 0 and its measured natural height
// (CSS-transitioned) and fades in — the same zero-dependency technique the tabs renderer uses, no
// motion lib. Each item's resolved sections are drawn with <Blocks>, so an item can hold any blocks.
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Blocks } from './Blocks.jsx'
import { registerBlockRenderer } from './registry.js'

// Measure before paint on the client; no-op (no warning) during SSR.
const useIsoLayout = typeof document !== 'undefined' ? useLayoutEffect : useEffect

// A rotating chevron, drawn from the current color so it inherits the header's text color.
function Chevron({ open }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// One accordion item: a header button + a height-morphing panel. Measures its own content height so
// the panel animates 0 <-> px (auto isn't animatable); the inner div is always rendered so it can be
// measured even while collapsed.
function AccordionItem({ item, open, onToggle }) {
  const contentRef = useRef(null)
  const [height, setHeight] = useState(open ? undefined : 0)
  useIsoLayout(() => {
    if (contentRef.current) setHeight(open ? contentRef.current.offsetHeight : 0)
  }, [open])

  return (
    <div data-slot="accordion-item" style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: '0.75rem',
          padding: '0.85rem 0.25rem',
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'left',
          color: 'var(--color-text, #0f172a)',
        }}
      >
        <span>{item.label}</span>
        <Chevron open={open} />
      </button>
      <div style={{ overflow: 'hidden', transition: 'height 0.28s ease', height: height != null ? height : 'auto' }}>
        <div
          ref={contentRef}
          role="region"
          style={{ opacity: open ? 1 : 0, transition: 'opacity 0.28s ease', paddingBottom: '0.85rem' }}
        >
          <Blocks sections={item.sections} />
        </div>
      </div>
    </div>
  )
}

export function AccordionView({ items = [], multiple = false, openValues = [] }) {
  const [openSet, setOpenSet] = useState(() => new Set(openValues))

  const toggle = (value) => {
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else {
        if (!multiple) next.clear() // single-open: opening one closes the rest
        next.add(value)
      }
      return next
    })
  }

  return (
    <div data-slot="accordion" style={{ margin: '0.75rem 0', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
      {items.map((item) => (
        <AccordionItem key={item.value} item={item} open={openSet.has(item.value)} onToggle={() => toggle(item.value)} />
      ))}
    </div>
  )
}

registerBlockRenderer('accordion', AccordionView)
