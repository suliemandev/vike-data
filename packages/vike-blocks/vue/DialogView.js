// The Vue renderer for the `dialog` block — the Vue twin of react/DialogView.jsx. Theme-native and
// dep-free: it does the portal (Teleport to <body>), backdrop, focus trap (Tab cycles inside the
// popup), Escape + backdrop-click to close, and body scroll-lock itself, with a CSS enter/exit.
// Open/close is local UI state. The body/footer resolved sections are drawn with <Blocks>.
import { h, ref, watch, onMounted, onUnmounted, nextTick, Teleport } from 'vue'
import { Blocks } from './Blocks.js'
import { registerBlockRenderer } from './registry.js'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
const ENTER_MS = 300
// A springy ease with a little overshoot, so the popup lands like Animate UI's spring (pure CSS).
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

let uid = 0

export const DialogView = {
  props: ['title', 'description', 'trigger', 'sections', 'footer', 'defaultOpen'],
  setup(props) {
    const open = ref(!!props.defaultOpen)
    const render = ref(!!props.defaultOpen) // in the DOM (kept during the exit transition)
    const visible = ref(false) // drives the enter/exit CSS
    const mounted = ref(false) // client only — the Teleport target exists after mount
    const popupEl = ref(null)
    const lastFocused = ref(null)
    const titleId = `vike-blocks-dialog-${uid++}`
    let exitTimer = null

    onMounted(() => (mounted.value = true))

    const trapAndClose = (e) => {
      if (e.key === 'Escape') {
        open.value = false
        return
      }
      if (e.key !== 'Tab' || !popupEl.value) return
      const nodes = Array.from(popupEl.value.querySelectorAll(FOCUSABLE))
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

    let prevOverflow = ''
    const lock = () => {
      document.addEventListener('keydown', trapAndClose)
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const unlock = () => {
      document.removeEventListener('keydown', trapAndClose)
      document.body.style.overflow = prevOverflow
    }

    // Once the popup is in the DOM: lock + focus, then paint the hidden "from" frame (a reflow) and
    // flip to visible on the next frame — otherwise mount + visible land in one frame and there is no
    // start state to animate from (which is why only the exit was animating).
    const enter = () =>
      nextTick(() => {
        lock()
        if (popupEl.value) void popupEl.value.getBoundingClientRect()
        requestAnimationFrame(() => (visible.value = true))
        const first = popupEl.value?.querySelector(FOCUSABLE)
        ;(first ?? popupEl.value)?.focus?.()
      })

    // Enter/exit lifecycle mirroring the React renderer.
    watch(open, (isOpen) => {
      if (exitTimer) {
        clearTimeout(exitTimer)
        exitTimer = null
      }
      if (isOpen) {
        lastFocused.value = document.activeElement
        render.value = true
        enter()
      } else {
        visible.value = false
        unlock()
        lastFocused.value?.focus?.()
        lastFocused.value = null
        exitTimer = setTimeout(() => (render.value = false), ENTER_MS)
      }
    })

    onMounted(() => {
      if (open.value) enter()
    })
    onUnmounted(() => {
      if (exitTimer) clearTimeout(exitTimer)
      unlock()
    })

    return () => {
      const sections = props.sections ?? []
      const footer = props.footer ?? []

      const triggerBtn = h(
        'button',
        {
          type: 'button',
          onClick: () => (open.value = true),
          style: {
            display: 'inline-block',
            padding: '0.5rem 0.9rem',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: 'var(--radius, 8px)',
            background: 'var(--color-surface, #f1f5f9)',
            color: 'var(--color-text, #0f172a)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          },
        },
        props.trigger ?? 'Open',
      )

      const closeBtn = h(
        'button',
        {
          type: 'button',
          'aria-label': 'Close',
          onClick: () => (open.value = false),
          style: { flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer', fontSize: '22px', lineHeight: 1, color: 'var(--color-muted, #64748b)' },
        },
        '×',
      )

      const headerChildren = [
        h('div', [
          h('h2', { id: titleId, style: { margin: 0, fontSize: '18px', fontWeight: 600 } }, props.title ?? ''),
          props.description ? h('p', { style: { margin: '0.25rem 0 0', fontSize: '14px', color: 'var(--color-muted, #64748b)' } }, props.description) : null,
        ]),
        closeBtn,
      ]

      const popup = h(
        'div',
        {
          ref: popupEl,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': titleId,
          tabindex: '-1',
          onClick: (e) => e.stopPropagation(),
          style: {
            width: '100%',
            maxWidth: '440px',
            padding: '1.25rem',
            background: 'var(--color-bg, #ffffff)',
            color: 'var(--color-text, #0f172a)',
            borderRadius: 'var(--radius, 12px)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
            opacity: visible.value ? 1 : 0,
            filter: visible.value ? 'blur(0px)' : 'blur(4px)',
            // A 3D flip in from the top + scale, matching Animate UI's signature enter/exit.
            transform: visible.value ? 'perspective(500px) rotateX(0deg) scale(1)' : 'perspective(500px) rotateX(-20deg) scale(0.9)',
            transition: `opacity ${ENTER_MS}ms ease, filter ${ENTER_MS}ms ease, transform ${ENTER_MS}ms ${SPRING}`,
          },
        },
        [
          h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' } }, headerChildren),
          sections.length > 0 ? h('div', { style: { marginTop: '0.85rem' } }, h(Blocks, { sections })) : null,
          // A dialog footer is dismiss actions: clicking any footer button closes the dialog (a button
          // that also mutates data is the actions axis, #385). A footer link still navigates.
          footer.length > 0
            ? h(
                'div',
                {
                  onClick: (e) => {
                    if (e.target.closest('button')) open.value = false
                  },
                  style: { marginTop: '1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
                },
                h(Blocks, { sections: footer }),
              )
            : null,
        ],
      )

      const overlay = h(
        'div',
        {
          role: 'presentation',
          onClick: () => (open.value = false),
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.5)',
            opacity: visible.value ? 1 : 0,
            transition: `opacity ${ENTER_MS}ms ease`,
          },
        },
        popup,
      )

      return h('span', { 'data-slot': 'dialog' }, [triggerBtn, mounted.value && render.value ? h(Teleport, { to: 'body' }, overlay) : null])
    }
  },
}

registerBlockRenderer('dialog', DialogView)
