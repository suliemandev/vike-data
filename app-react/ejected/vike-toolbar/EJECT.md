# Ejected: vike-toolbar

This folder is an **ejected** copy of the `vike-toolbar` extension. The app owns this
source now and can edit any line of it, instead of being limited to the extension's
config surface. This is the long-tail half of the two-tier customization model (see the
root [CUSTOMIZATION.md](../../../CUSTOMIZATION.md)).

The app-owned change here is the branded "Acme settings" header in
[`react/Toolbar.jsx`](./react/Toolbar.jsx) - the kind of structural tweak you would not
expose as a per-app config knob.

## How it was ejected

1. Copied the package source into the app: `packages/vike-toolbar/` to
   `app-react/ejected/vike-toolbar/` (dropping `test/` and any `node_modules/`).
2. Pointed the app's dependency at the copy, in `app-react/package.json`:
   ```json
   "vike-toolbar": "file:./ejected/vike-toolbar"
   ```
   (was `"workspace:*"`), then re-ran `pnpm install`.
3. Edited the source freely.

The package name stays `vike-toolbar` on purpose. The extension wires its React layer with
Vike `import:` pointer specifiers (e.g. `import:vike-toolbar/react/ToolbarWrapper:default`),
which resolve by package name - so keeping the name and swapping the dependency to this copy
makes every reference, top-level and internal, point here. A relative-path import or a Vite
alias would only redirect the top-level import and leave the internal pointers aimed at the
original package.

To un-eject, restore `"vike-toolbar": "workspace:*"` and delete this folder.
