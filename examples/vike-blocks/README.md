# vike-blocks example

vike-blocks used directly — no schema, no data layer, no Tailwind. A page is a composition of **blocks**, and a block is a `{ block: 'type', ...props }` descriptor drawn by a registered per-framework renderer.

## What it shows

- **Compose primitives** (`/`): `definePage({ sections: [...] })` composes the built-in blocks (`heading`/`text`/`badge`/`divider`/`link`) with their fluent builders, rendered by `<Page>`.
- **A custom block** (`pages/callout.block.jsx`): `defineBlock('callout', { build, refine })` + `registerBlockRenderer('callout', Component)` add a new block *in the app*. It composes exactly like the built-ins — a third-party block is a peer, not a special case.
- **Two authoring styles**: the home route uses fluent builders (`callout('Heads up').tone('warn').body('...')`); `/raw` hand-writes the same page as plain `{ block, ...props }` descriptors and draws them with `resolvePage` + `<Blocks>` (the low-level path `<Page>` wraps). Because a block is just data, a page can be stored, generated, or streamed.

## Run

From the repo root:

```bash
pnpm install
pnpm --filter app-vike-blocks dev
```

Open http://localhost:4300.

## Files

```
pages/
  callout.block.jsx   defineBlock('callout') + registerBlockRenderer('callout') — a custom block
  index/+Page.jsx     definePage(...) with fluent builders, rendered by <Page>
  raw/+Page.jsx       the same page as plain descriptors, via resolvePage + <Blocks>
  +config.js          extends vike-react (vike-blocks is a library, not a Vike extension)
```

## Relationship to vike-view

vike-view layers a schema/data tier on top of this: its `list`/`record`/`form` blocks derive their descriptors from your data schema, and `viewPages` generates Vike pages from a `defineView` route. See `examples/vike-view`. Here there is no schema — just blocks composed by hand.
