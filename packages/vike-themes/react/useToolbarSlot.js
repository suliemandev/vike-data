// Decide where this extension's picker renders, composing with vike-toolbar:
//   undefined -> PENDING: render nothing yet (server + first client paint)
//   element   -> TELEPORT the live control into the toolbar popover
//   null      -> no toolbar installed: render STANDALONE
//
// The decision is deferred to an effect so the server render and the first client
// render agree (both PENDING -> the picker renders nothing), which is what kills the
// flash of a standalone picker that then jumps into the toolbar. After mount: if the
// toolbar's teleport target (#vike-toolbar-items) is present we teleport; if the
// toolbar isn't installed at all (its `bodyHtmlEnd` root #vike-toolbar-root is absent)
// we fall back to standalone; otherwise the toolbar is installed but its panel hasn't
// portaled in yet, so we wait for it (MutationObserver) — never showing standalone in
// between. The contract is two well-known DOM ids, so no import of vike-toolbar.
import { useState, useEffect } from 'react'

const ROOT_ID = 'vike-toolbar-root'
const ITEMS_ID = 'vike-toolbar-items'

export function useToolbarSlot() {
  const [slot, setSlot] = useState(undefined) // PENDING on server + first client render
  useEffect(() => {
    const items = document.getElementById(ITEMS_ID)
    if (items) {
      setSlot(items) // toolbar ready -> teleport
      return
    }
    if (!document.getElementById(ROOT_ID)) {
      setSlot(null) // no toolbar installed -> standalone
      return
    }
    // Toolbar installed but its panel hasn't portaled in yet -> wait, stay PENDING.
    const obs = new MutationObserver(() => {
      const node = document.getElementById(ITEMS_ID)
      if (node) {
        setSlot(node)
        obs.disconnect()
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])
  return slot
}
