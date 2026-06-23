// vike-toolbar — the config SEAM (epic #120, #121).
//
// It declares ONE cumulative point, `toolbarItems`, that extensions advertise their
// settings into — the same pattern as `nav` / `themes` / `messages`. An entry's
// `Control` is a per-framework control component, carried through config as a
// pointer-import string (`'import:module:export'`), exactly like vike-auth's
// cumulative `resolveUser` enrichers: Vike resolves those strings to the real values
// in each environment, so a component survives to the client without serialization.
//
// `env` is server + client (NOT config): the popover SSRs then renders on the client,
// but the items must NOT be loaded during config resolution — an entry's `Control` is a
// .jsx component, and Vike resolves config in plain Node, which can't load JSX. Keeping
// `config` off is why a contributor's `+toolbarItems.js` may import its control directly
// (same reason vike-admin's `adminResources` is server-env, not config-env).
//
// Framework-agnostic: this file imports no UI; the React Wrapper that reads
// `toolbarItems` and renders the button + popover is pulled in by the
// vike-toolbar/react subpath.
export default {
  name: 'vike-toolbar',
  meta: {
    toolbarItems: { env: { server: true, client: true }, cumulative: true },
  },
  toolbarItems: [],
}
