// Resolve a DOM node by id for a portal/teleport, returning null until it exists.
//
// The target here is the `bodyHtmlEnd` node (and, for contributors, the toolbar panel)
// which lives OUTSIDE the framework hydration root — so it is present in the SSR HTML,
// but React only sees it client-side. On the server this returns null (render nothing);
// on the client it resolves after mount, and a MutationObserver covers the case where
// the node is injected slightly later (e.g. the panel the toolbar itself portals in).
// Pure JS (no JSX) so it can be shared/imported wherever a control teleports.
import { useState, useEffect } from 'react'

export function usePortalTarget(id) {
  const [el, setEl] = useState(null)
  useEffect(() => {
    const found = document.getElementById(id)
    if (found) {
      setEl(found)
      return
    }
    const obs = new MutationObserver(() => {
      const node = document.getElementById(id)
      if (node) {
        setEl(node)
        obs.disconnect()
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [id])
  return el
}
