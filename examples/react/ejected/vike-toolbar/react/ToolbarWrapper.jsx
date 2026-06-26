// The vike-react Wrapper contributed by vike-toolbar/react. It renders the page
// untouched and mounts the toolbar surface alongside it. The surface itself portals
// into the `bodyHtmlEnd` node (outside the hydration root), so this Wrapper's position
// in the provider tree doesn't matter — what lands in the toolbar is whatever each
// extension teleports into it, plus any simple `toolbarItems` the app contributes.
import { usePageContext } from 'vike-react/usePageContext'
import { allToolbarItems } from '../index.js'
import { Toolbar } from './Toolbar.jsx'

export default function ToolbarWrapper({ children }) {
  const items = allToolbarItems(usePageContext().config?.toolbarItems)
  return (
    <>
      {children}
      <Toolbar items={items} />
    </>
  )
}
