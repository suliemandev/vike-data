# vike-elements

Composable UI as data. The framework-agnostic substrate for building a page out of **blocks**
— a block descriptor IR, an open registry, the `definePage` composer, the built-in primitive
elements, and the `defineElement` seam so any package can ship a new element with high DX.

`vike-view` layers schema-driven blocks (list / record / form derived from your data schema)
on top of this; a per-framework package (e.g. a React renderer) draws the blocks.

## A page is a composition of blocks

```js
import { definePage, heading, badge, divider, link } from 'vike-elements'

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

## The open registry + `defineElement`

Blocks live in an open registry — add one with `registerBlock(type, { resolve })`, or, for a
leaf element with a fluent builder, `defineElement`:

```js
// vike-element-rating (a third-party package) — the agnostic half, one call
import { defineElement } from 'vike-elements'

export const rating = defineElement('rating', {
  build:  (value) => ({ value }),                       // rating(3) -> { block:'rating', value:3 }
  refine: { max: (n) => ({ max: n }), readonly: () => ({ readonly: true }) },
})
// author usage:  rating(3).max(5).readonly()
```

```js
// vike-element-rating/react — the renderer half, per framework
// (`registerElementRenderer` is provided by the per-framework renderer package, e.g. a
// forthcoming vike-elements/react — not by this agnostic core.)
import { registerElementRenderer } from 'vike-elements/react'
registerElementRenderer('rating', Rating)
```

Define once (builder + descriptor + registry entry), render once per framework. The built-in
elements (`text`/`heading`/`badge`/`divider`/`link`) are defined through this same seam, so
your custom element is a peer, not a special case.

## What a renderer does with a resolved page

`resolvePage(page, tables)` returns `{ route, sections: [{ block, props, resolved }] }`. A
per-framework renderer keeps a `block -> component` map and draws each section, handing the
component the block's serializable `resolved` view-model:

```jsx
// sketch of a React renderer
const COMPONENTS = { list: ListView, record: RecordView, heading: Heading, /* ... */ }

function Page({ page, tables }) {
  const { sections } = resolvePage(page, tables)
  return sections.map(({ block, resolved }, i) => {
    const C = COMPONENTS[block]
    return C ? <C key={i} {...resolved} /> : null
  })
}
```

`resolved` is plain data (a schema block's `columns`/`fields`, a bespoke block's props), so it
serializes cleanly into the client hydration payload.

## The escape hatch

The genuine long tail that no block expresses drops to `block: 'custom'` (your component) or an
AI-ejected real page. There is deliberately **no** layout / expression / data-binding DSL —
that's the low-code trap this avoids.
