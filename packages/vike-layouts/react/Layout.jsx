// <Layout> — picks the shell by name and renders the children inside it. The
// SELECTION + slot resolution is the framework-agnostic core's job (vike-layouts
// defineLayout); this only maps a resolved shell name to its React component.
//
// The component map mirrors vike-layouts' open registry: pass `shells` to add a
// component for a shell a third-party registered via registerShell().
import { defineLayout } from '../index.js'
import { CenteredShell } from './shells/CenteredShell.jsx'
import { TopbarShell } from './shells/TopbarShell.jsx'
import { SidebarShell } from './shells/SidebarShell.jsx'

const BUILTIN = { centered: CenteredShell, topbar: TopbarShell, sidebar: SidebarShell }

export function Layout({ children, shells = {}, ...config }) {
  const resolved = defineLayout(config)
  const components = { ...BUILTIN, ...shells }
  const Shell = components[resolved.shell] || CenteredShell
  return <Shell layout={resolved}>{children}</Shell>
}
