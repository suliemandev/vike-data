// The config SEAM for layouts — same as themes/billing: install the extension,
// set a sibling config key. vike-layouts declares the contribution points
// (framework-agnostic, no UI here); the React shells are the vike-layouts/react subpath.
//
//   - `layout` : the app-shell to render, by name (centered/topbar/sidebar, or a
//                registered 4th). A single selection, so the app sets a default
//                and a page overrides it — e.g. pages/login/+config.js sets
//                `layout: 'centered'` while the rest of the app stays 'topbar'.
//   - `logo`   : the logo slot (a string for the demo).
//   - `nav`    : the nav slot. CUMULATIVE, so an extension can contribute its own
//                nav links, not just the app.
export default {
  name: 'vike-layouts',
  meta: {
    layout: { env: { config: true, server: true, client: true } },
    logo: { env: { config: true, server: true, client: true } },
    nav: { env: { config: true, server: true, client: true }, cumulative: true },
  },
  layout: 'centered',
}
