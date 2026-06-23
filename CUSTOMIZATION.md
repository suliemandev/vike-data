# Customization: settings vs eject

Every extension here follows a **two-tier customization model**, so each one's config
surface stays small and deliberate while the app still has full control all the way down.

1. **Settings** cover the common cases: the few knobs an extension deliberately exposes
   (which theme, light or dark, which locales, a `defineResource` refinement). These are
   the choices an app makes constantly, so they are worth a stable, named surface.
2. **Eject** covers the long tail: copy an extension's source into the app and own it,
   instead of adding a setting for every edge case. This is the same escape hatch as
   Laravel `vendor:publish` or shadcn's copy-in components, and Vike documents it at
   <https://vike.dev/eject>.

The rule is not "expose every token as a setting." It is **expose the few coarse choices a
user makes constantly, and make everything else an eject.** A bigger config surface looks
flexible but it ages badly: every knob is forever, and the long tail of edge cases never
ends. Ejecting keeps the surface honest.

## Where the line sits (the fonts example)

Fonts are the canonical "everything else" case. Should there be a `vike-fonts` extension,
or a per-font knob, so fonts are customizable independently of a theme?

No. A font is a crucial part of a theme; designers treat a theme as the whole thing, so
splitting fonts out as their own surface does not make sense. The code already reflects
this: `defineTheme({ name, fonts: { sans, mono }, radius, spacing, light, dark })` carries
fonts as first-class tokens, emitted as `--font-sans` / `--font-mono`. A custom or
third-party theme (`vike-theme-emerald`, or the app's own `acme` brand) sets them there.

So:

- **Settings** = pick the active theme and appearance (`theme`, `appearance`), and author a
  whole brand via `defineTheme` (already easy).
- **Eject** = anything finer-grained or structural about a theme, fonts among them. You do
  not get a per-token knob; you take ownership of the theme.

## The in-between: compose and override before you eject

Ejecting is the last resort, not the first. Reach for it only after the lighter seams do
not fit:

- **Configure** with a sibling key (`theme`, `locales`, `layout`, `segment`).
- **Refine** with a `define*` (`defineResource` for admin columns and per-row `scope`,
  `defineTheme` for a brand, `defineLayout` for a shell).
- **Extend** with an `extend*` (`extendSchema` to add columns to another extension's table).
- **Override** a contribution (retranslate a string, restyle a theme) from the app, since
  the app's contribution wins in the cumulative merge.
- **Eject** when none of those reach far enough: own the source.

## Eject recipe (AI-assisted)

Eject works best from an extension's **original source**, not built JavaScript. The
`eject` package (<https://github.com/snake-py/eject>) copies compiled output, which is hard
to read and edit; pulling the source from the package or Git and adapting it cleanly into
the app is the better fit, and a good fit for an AI workflow ("copy this extension's source
into `ejected/`, wire it up, then make change X").

The steps, with [`app-react/ejected/vike-toolbar`](./app-react/ejected/vike-toolbar/) as a
worked proof:

1. **Copy the source** into the app under `ejected/<extension>/`. Take the readable source
   tree (`+config.js`, `react/*.jsx`, assets), and drop what the app does not own: the
   package's `test/` and any `node_modules/`.

2. **Point the dependency at the copy.** In the app's `package.json`, swap the package for
   the local path:
   ```json
   "vike-toolbar": "file:./ejected/vike-toolbar"
   ```
   (was `"workspace:*"` or a version range), then re-run `pnpm install`.

   Keep the **package name** the same. Vike extensions wire their per-framework layer with
   `import:` pointer specifiers (for example `import:vike-toolbar/react/ToolbarWrapper:default`),
   which resolve by package name. Keeping the name and re-pointing the dependency makes every
   reference, top-level and internal, resolve to the ejected copy. A relative-path import or a
   Vite alias would redirect only the top-level import and leave the internal pointers aimed at
   the original package.

3. **Edit freely.** The app now owns every line. In the proof, the app-owned change is a
   branded "Acme settings" header in the toolbar panel, a structural tweak you would not
   expose as a config knob.

To un-eject, restore the original dependency spec and delete the folder.

## For extension authors

Keep the config surface small on purpose. Before adding a setting, ask whether it is a
choice an app makes constantly (worth a knob) or a long-tail edge case (an eject). Keep the
source eject-friendly: readable, with minimal hidden coupling, so copying it into an app and
owning it stays low-friction.
