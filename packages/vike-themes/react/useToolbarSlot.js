// Resolve the toolbar's teleport target (#vike-toolbar-items) if a vike-toolbar is
// installed, else null — so this extension's picker teleports its LIVE control into the
// shared toolbar when present, and renders standalone otherwise. The contract is a
// well-known DOM id (no import of vike-toolbar), so the extension stays decoupled and
// works with or without the toolbar. Null on the server + until the node resolves
// client-side (the toolbar portals it in after mount); a MutationObserver catches that.
import { useState, useEffect } from 'react'

const SLOT_ID = 'vike-toolbar-items'

export function useToolbarSlot() {
  const [el, setEl] = useState(null)
  useEffect(() => {
    const found = document.getElementById(SLOT_ID)
    if (found) {
      setEl(found)
      return
    }
    const obs = new MutationObserver(() => {
      const node = document.getElementById(SLOT_ID)
      if (node) {
        setEl(node)
        obs.disconnect()
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])
  return el
}
