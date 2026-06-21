// React shells for vike-layouts. <Layout> dispatches by shell name; the
// individual shells are exported for direct use (e.g. the login page renders
// <CenteredShell> straight). Re-exports the core registry helpers for convenience.
export { Layout } from './Layout.jsx'
export { CenteredShell } from './shells/CenteredShell.jsx'
export { TopbarShell } from './shells/TopbarShell.jsx'
export { SidebarShell } from './shells/SidebarShell.jsx'
export { shells, registerShell, isAppShell, defineLayout } from 'vike-layouts'
