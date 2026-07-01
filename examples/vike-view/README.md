# vike-view example

The smallest possible schema-driven app. One `defineSchema('posts')` becomes a full CRUD page, with no page components, forms, or controllers written by hand.

## What it shows

- **Page generation** (`/posts`): `viewPages(views)` turns a `defineView({ route, sections: crudBlocks({ table: 'posts' }) })` into a real Vike page. GET renders the list + create form derived from the schema; POST writes a row through the owner-scoped data hook and redirects back, so the new row shows on reload. No page code exists for this route.
- **Mix into a normal app** (`/inline`): a hand-written vike-react page that imports vike-view's `<ListView>` block and renders it directly, no page-gen. Proves the blocks compose into pages you already own; they are not lock-in.
- **Owner scoping**: the view's `scope: (table, ctx) => ({ user_id: ctx.user.id })` bounds every read and forces `user_id` onto every write. The demo identity comes from `+onCreatePageContext.js` (a real app installs vike-auth instead).

## Run

From the repo root:

```bash
pnpm install
pnpm --filter app-vike-view dev
```

Open http://localhost:4200. The store is the in-memory adapter (cached on `globalThis`, so writes persist across requests within a dev run). Drop in a real database exactly like `examples/drizzle-pglite` -- only `+onCreateGlobalContext.js` changes; the app config does not.

## The whole app

```
pages/
  posts.schema.js          one defineSchema('posts')  -- the intent
  +views.js                defineView({ route: '/posts', sections: crudBlocks({ table: 'posts' }) })
  +config.js               extends vike-react + vike-view; schemas + pages: viewPages(views)
  +onCreatePageContext.js  a demo user (owner-scoping needs one)
  index/+Page.jsx          two links
  inline/+Page.jsx         the mix-in path: <ListView> in a hand-written page
  inline/+data.js          resolves columns + fetches owner-scoped rows
```
