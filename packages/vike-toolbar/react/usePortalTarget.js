// Resolve a DOM node by id for a portal, returning null until it exists.
//
// The target is the `bodyHtmlEnd` node, which lives OUTSIDE the framework hydration
// root — so it's already in the SSR HTML and present on the very first CLIENT render.
// We resolve it synchronously in the initializer so the toolbar button appears
// immediately on hydration (no post-mount flash); a portal's content lives outside the
// local React tree, so rendering it on the first client paint doesn't desync hydration
// (the local subtree is empty on both server and client). On the server `document` is
// absent, so this is null and the button simply isn't part of the SSR HTML.
import { useState, useEffect } from 'react'

const resolve = (id) => (typeof document === 'undefined' ? null : document.getElementById(id))

export function usePortalTarget(id) {
  const [el, setEl] = useState(() => resolve(id))
  useEffect(() => {
    if (el) return
    const found = resolve(id)
    if (found) {
      setEl(found)
      return
    }
    const obs = new MutationObserver(() => {
      const node = resolve(id)
      if (node) {
        setEl(node)
        obs.disconnect()
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [id, el])
  return el
}
