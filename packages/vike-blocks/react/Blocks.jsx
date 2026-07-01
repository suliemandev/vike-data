// The dispatch: draw a page's blocks by mapping each section's block type to its registered
// React component and handing it the section's resolved view-model. `<Blocks>` takes already
// resolved sections; `<Page>` resolves a view first (so an app can hand it a defineView/
// definePage result + the composed tables). A block type with no registered renderer is skipped
// (returns nothing) rather than throwing, so a page degrades gracefully. Importing this module
// registers the built-in element renderers (via ./elements.jsx).
import { resolvePage } from '../page.js'
import { getBlockRenderer } from './registry.js'
import './elements.jsx' // side-effect: register text / heading / badge / divider / link / markdown / stat

// Draw a list of RESOLVED sections (`{ block, props, resolved }`, from resolvePage/resolveView).
export function Blocks({ sections = [] }) {
  return (
    <>
      {sections.map((section, i) => {
        const Component = getBlockRenderer(section.block)
        if (!Component) return null // no renderer registered for this block type -> skip
        return <Component key={i} {...section.resolved} />
      })}
    </>
  )
}

// Resolve a view/page against the composed tables, then draw it. `page` is a defineView/
// definePage result; `tables` is the merged schema (resolveViewTables(config)) for schema blocks.
export function Page({ page, tables }) {
  const resolved = resolvePage(page, tables)
  return <Blocks sections={resolved.sections} />
}
