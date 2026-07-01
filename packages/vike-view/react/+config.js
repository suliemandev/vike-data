// The installable Vike extension for the React view pages. An app does
// `import vikeView from 'vike-view/react/config'; extends: [vikeView]`, declares its views, and
// spreads `viewPages(views)` into `pages` — each view.route becomes a real page (GET renders the
// hydrated view, POST writes through the scoped data hook). It self-installs vike-schema (the
// `schemas` point the views derive from) with Vike's pointer-import string.
//
//   import vikeView from 'vike-view/react/config'
//   import { defineView, crudBlocks, viewPages } from 'vike-view/react/pages'
//   const views = [defineView({ route: '/posts', sections: crudBlocks({ table: 'posts' }) })]
//   export default { extends: [vikeView], views, pages: viewPages(views) }
//
// The authoring helpers come from 'vike-view/react/pages' (jsx-free), NOT the 'vike-view/react'
// barrel: +config is loaded by Vike's Node config loader, which can't transpile the .jsx the
// barrel pulls in. The barrel ('vike-view/react') is for RUNTIME page components (ListView, etc.).
//
// `views` is a SERVER-only (not config-env) cumulative point: server-only so a view's `scope`
// FUNCTION survives to the data hook instead of being JSON-serialized away (the resolveUser
// precedent); cumulative so several sources can contribute. The generated pages carry the routes
// at config time (viewPages runs in the app's config), so the data hook is the only reader of
// `views`, at request time, on the server.
export default {
  name: 'vike-view-react',
  extends: ['import:@vike-data/vike-schema/config:default'],
  meta: {
    views: { env: { server: true }, cumulative: true },
  },
  views: [],
}
