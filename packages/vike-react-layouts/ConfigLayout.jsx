// The vike-react Layout contributed by vike-react-layouts/config. It reads the
// resolved layout config (selection + slots) off pageContext and renders the
// matching shell around the page — so a page just sets `layout: 'topbar'` in its
// config and gets the shell, with no <Layout> wrapper in the page component.
//
// The selection + slot normalization is the framework-agnostic core's job
// (vike-layouts defineLayout); this only maps the resolved shell name to its
// React component.
import { usePageContext } from 'vike-react/usePageContext'
import { defineLayout } from 'vike-layouts'
import { CenteredShell } from './shells/CenteredShell.jsx'
import { TopbarShell } from './shells/TopbarShell.jsx'
import { SidebarShell } from './shells/SidebarShell.jsx'

const SHELLS = { centered: CenteredShell, topbar: TopbarShell, sidebar: SidebarShell }

export default function ConfigLayout({ children }) {
  const pageContext = usePageContext()
  const config = pageContext.config || {}
  const resolved = defineLayout({
    shell: config.layout,
    logo: config.logo,
    // `nav` is cumulative -> an array of each source's contribution; flatten.
    nav: (config.nav || []).flat(),
  })
  const Shell = SHELLS[resolved.shell] || CenteredShell
  return <Shell layout={resolved}>{children}</Shell>
}
