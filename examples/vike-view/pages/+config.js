// The whole app wiring, in one file. Two extensions installed via `extends`, one schema, and the
// generated pages -- that is the entire footprint of a schema-driven CRUD app.
//
//   - vike-react: the React renderer.
//   - vike-view/react: the schema-driven view layer. It self-installs vike-schema (the `schemas`
//     point the views derive from) and provides the generic ViewPage + data hook the generated
//     pages point at.
//
// `schemas` contributes the `posts` table. The views themselves live in +views.js (they carry a
// `scope` function, which Vike requires be in its own +file, not inline here). We import that same
// array only to compute `pages: viewPages(views)` -- turning each view.route into a real page.
// Nothing else -- no page components, no forms, no controllers.
import vikeReact from 'vike-react/config'
import vikeView from 'vike-view/react/config'
import { viewPages } from 'vike-view/react/pages'
import views from './+views.js'
import { postsSchema } from './posts.schema.js'

export default {
  extends: [vikeReact, vikeView],
  title: 'vike-view example',

  schemas: [postsSchema],
  pages: viewPages(views),
}
