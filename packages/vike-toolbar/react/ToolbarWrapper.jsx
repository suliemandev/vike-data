// The vike-react Wrapper contributed by vike-toolbar/react. It reads the composed
// `toolbarItems` off the page config and renders the fixed logo button + popover around
// the page — the same overlay approach as vike-themes' ThemeWrapper, so no slot wiring
// in the shells is required and it works under any layout.
//
// The Wrapper is the SSR/agnostic half (reads config, composes the list); the Toolbar it
// renders is the interactive (client) button + popover.
import { usePageContext } from 'vike-react/usePageContext'
import { allToolbarItems } from '../index.js'
import { Toolbar } from './Toolbar.jsx'

export default function ToolbarWrapper({ children }) {
  const pageContext = usePageContext()
  const items = allToolbarItems(pageContext.config?.toolbarItems)
  // Nothing contributed (extension installed but empty) — render the page untouched.
  if (!items.length) return children
  return (
    <>
      {children}
      <Toolbar items={items} />
    </>
  )
}
