# vike-blocks

Composable UI as data. The framework-agnostic substrate for building a page out of **blocks**
— a block descriptor IR, an open registry, the `definePage` composer, the built-in primitive
blocks, and the `defineBlock` seam so any package can ship a new block with high DX.

`vike-view` layers schema-driven blocks (list / record / form derived from your data schema)
on top of this; a per-framework package (e.g. a React renderer) draws the blocks.

## A page is a composition of blocks

```js
import { definePage, heading, badge, divider, link } from 'vike-blocks'

definePage({
  route: '/dashboard',
  sections: [
    heading('Welcome'),
    { block: 'stat',     title: 'Revenue', source: 'orders.sum(total)' },
    { block: 'markdown', source: '# Notes' },
    badge('Beta').tone('info'),
    divider(),
    link('Docs').to('/docs'),
    { block: 'custom',   component: 'MyChart' }, // your own component
  ],
})
```

`resolvePage(page, tables)` turns the block descriptors into plain, serializable view-models a
renderer draws (`{ block, props, resolved }` per section). A bespoke block echoes its props; a
schema-derived block (registered by vike-view) fills its `columns`/`fields` from the schema.

## Built-in block catalog

All built-ins are theme-native (colors and radius read vike-themes `var(--color-*)` / `--radius`)
and render the same in React and Vue over one IR. Each has a live demo in `examples/vike-blocks`.

**Leaf blocks** (fluent builders, a pass-through view-model):

```js
import { heading, text, badge, divider, link, button, alert } from 'vike-blocks'

heading('Title').level(2)                 // <h1>..<h6>, top margin scales with the level
text('Body copy').tone('muted')           // muted / danger / success / info, or theme text
badge('Beta').tone('info')
divider()
link('Docs').to('/docs')
button('Save').variant('primary').size('md').to('/back')   // primary/secondary/ghost/danger; .to renders an <a>
alert('Heads up').intent('warning').body('Your trial ends in 3 days.')  // info/success/warning/danger
```

**Container blocks** (interactive, hold a nested composition of blocks, resolved recursively;
which is open is local UI state in the renderer):

```js
import { tabs, accordion, dialog, heading, text, button } from 'vike-blocks'

tabs()
  .tab('account', 'Account', [heading('Account').level(3), text('Your profile.')])
  .tab('password', 'Password', [text('Change your password.')])
  .defaultValue('account')                // sliding highlight + measured height morph, pure CSS

accordion()
  .item('shipping', 'Shipping', [text('Ships in 2-3 days.')])
  .item('returns', 'Returns', [text('30-day returns.')])
  .multiple()                             // omit for single-open (default)
  .defaultValue(['shipping'])             // initial open item(s)

dialog()
  .title('Delete post')
  .description('This cannot be undone.')
  .trigger('Delete')                      // the opening button's label
  .sections([text('Are you sure?')])
  .footer([button('Cancel').variant('ghost'), button('Delete').variant('danger')])
  // dep-free portal + backdrop + focus trap + Escape / outside-click + scroll-lock, CSS enter/exit
```

**Bespoke pass-throughs** (the renderer draws them from their props): `stat` (`{ title, source|value }`),
`markdown` (`{ source }`), `custom` (`{ component }`, your own component). vike-view registers the
schema-derived blocks (`list` / `record` / `form`) into the same registry.

## The open registry + `defineBlock`

Blocks live in an open registry — add one with `registerBlock(type, { resolve })`, or, for a
leaf block with a fluent builder, `defineBlock`:

```js
// vike-block-rating (a third-party package) — the agnostic half, one call
import { defineBlock } from 'vike-blocks'

export const rating = defineBlock('rating', {
  build:  (value) => ({ value }),                       // rating(3) -> { block:'rating', value:3 }
  refine: { max: (n) => ({ max: n }), readonly: () => ({ readonly: true }) },
})
// author usage:  rating(3).max(5).readonly()
```

```js
// vike-block-rating/react — the renderer half, per framework
// (`registerBlockRenderer` lives in vike-blocks/react, the React binding.)
import { registerBlockRenderer } from 'vike-blocks/react'
registerBlockRenderer('rating', Rating)
```

Define once (builder + descriptor + registry entry), render once per framework. The built-in
blocks (`text`/`heading`/`badge`/`divider`/`link`) are defined through this same seam, so
your custom block is a peer, not a special case.

## Rendering — `vike-blocks/react` (and `/vue`)

> `vike-blocks/vue` is the exact Vue twin — same `registerBlockRenderer` + `<Blocks>`/`<Page>` + primitive components, over the shared `blocks`/`vue` registry slot.


The React binding ships the dispatch and the primitive components. `<Blocks>` draws already
resolved sections; `<Page>` resolves a view first. Each block type maps to its registered
component (via the shared registry), which receives the block's serializable `resolved` model:

```jsx
import { Page } from 'vike-blocks/react'          // + 'vike-view/react' to render list/record/form
import { defineView, crudBlocks, heading } from 'vike-view'

const view = defineView({ sections: [heading('Posts'), ...crudBlocks({ table: 'posts' })] })
// <Page page={view} tables={tables} /> -> the schema drives the table columns, record fields,
// and form controls (an enum column renders a <select>, a required column is marked, ...).
```

`resolved` is plain data (a schema block's `columns`/`fields`, a bespoke block's props), so it
serializes cleanly into the client hydration payload. A block type with no registered renderer
is skipped, so a page degrades gracefully.

## The escape hatch

The genuine long tail that no block expresses drops to `block: 'custom'` (your component) or an
AI-ejected real page. There is deliberately **no** layout / expression / data-binding DSL —
that's the low-code trap this avoids.
