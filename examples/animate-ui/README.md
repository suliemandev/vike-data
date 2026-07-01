# Animate UI sandbox (in Vike)

A place to run [Animate UI](https://animate-ui.com) components unmodified inside a Vike + React app, before harvesting parts into the vike-\* extensions.

Animate UI is shadcn-style (copy-paste, not an npm package): component `.tsx` files are installed into `components/animate-ui/` from the registry. This sandbox uses the **`animate`** primitive variant — pure **motion** + Tailwind, no Base UI or Radix dependency — which is the lightest to adapt later.

## What's here

- `components/animate-ui/primitives/animate/tabs.tsx` — the Animate UI animate Tabs primitive, plus its registry deps (`effects/highlight`, `animate/slot`, `lib/get-strict-context`), copied in as-is.
- `lib/utils.ts` — the `cn` helper the components import from `@/lib/utils`.
- `styles.css` — Tailwind v4 + a compact shadcn token set (only what the demo uses).
- `pages/index/+Page.tsx` — the tabs demo, running under Vike SSR.

## Run

```bash
pnpm install
pnpm --filter app-animate-ui dev
```

Open http://localhost:4400 — switching tabs slides the highlight and animates the panel height.

## Installing more components

Add any Animate UI component from its registry (the `@/` alias -> app root, Tailwind, and `cn` are already set up):

```bash
pnpm dlx shadcn@latest add https://animate-ui.com/r/primitives-animate-<name>.json
```

## Next: harvest into the extensions

This is the sandbox, not the destination. The plan is to adapt these into vike-blocks blocks (e.g. a `tabs` `defineBlock`) — trading Tailwind classes for the extensions' CSS-variable theming (vike-themes) and keeping the motion behaviour. See the epic for the built-in block catalog.
