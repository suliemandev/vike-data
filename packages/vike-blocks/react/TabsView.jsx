// The React renderer for the `tabs` block. Theme-native: every color / radius reads a vike-themes
// CSS variable (with a fallback), so a theme restyles it for free. The active tab is local UI
// state; the sliding highlight is pure CSS (equal-width tabs -> the indicator is one tab wide and
// translateX'd to the active index). Switching a tab fades the new panel in and morphs the panel
// area's height to fit it (measured, then CSS-transitioned) — all zero-dependency, no motion lib.
// Each panel's resolved sections are drawn with <Blocks>, so a panel can hold any blocks.
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Blocks } from './Blocks.jsx'
import { registerBlockRenderer } from './registry.js'

// Measure before paint on the client; no-op (no warning) during SSR.
const useIsoLayout = typeof document !== 'undefined' ? useLayoutEffect : useEffect

export function TabsView({ tabs = [], activeValue }) {
  const [active, setActive] = useState(activeValue ?? tabs[0]?.value)
  const n = tabs.length || 1
  const index = Math.max(0, tabs.findIndex((t) => t.value === active))
  const activePanel = tabs.find((t) => t.value === active) ?? tabs[0]

  // Height morph: measure the active panel's natural height and set it on the (overflow-hidden)
  // container, which transitions. The first measure goes auto -> px instantly (auto isn't
  // animatable); every later tab switch animates px -> px.
  const contentRef = useRef(null)
  const [height, setHeight] = useState(null)
  useIsoLayout(() => {
    if (contentRef.current) setHeight(contentRef.current.offsetHeight)
  }, [active])

  return (
    <div data-slot="tabs" style={{ marginTop: '0.75rem' }}>
      <style>{'@keyframes vike-blocks-tab-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
      <div
        role="tablist"
        style={{
          position: 'relative',
          display: 'flex',
          padding: 4,
          background: 'var(--color-surface, #f1f5f9)',
          borderRadius: 'var(--radius, 8px)',
        }}
      >
        {/* the sliding highlight: one tab wide, moved to the active index */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: `calc((100% - 8px) / ${n})`,
            transform: `translateX(${index * 100}%)`,
            transition: 'transform 0.25s ease',
            background: 'var(--color-bg, #ffffff)',
            borderRadius: 'calc(var(--radius, 8px) - 2px)',
          }}
        />
        {tabs.map((t) => {
          const on = t.value === active
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.value)}
              style={{
                position: 'relative',
                zIndex: 1,
                flex: 1,
                padding: '0.4rem 0.75rem',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: on ? 600 : 400,
                color: on ? 'var(--color-text, #0f172a)' : 'var(--color-muted, #64748b)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: '1rem', overflow: 'hidden', transition: 'height 0.25s ease', height: height != null ? height : 'auto' }}>
        {/* `key={active}` remounts on switch, so the fade-in keyframe replays; contentRef measures
            its natural height for the morph. */}
        <div ref={contentRef} key={active} role="tabpanel" style={{ animation: 'vike-blocks-tab-in 0.25s ease' }}>
          {activePanel && <Blocks sections={activePanel.sections} />}
        </div>
      </div>
    </div>
  )
}

registerBlockRenderer('tabs', TabsView)
