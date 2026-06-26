# app-two-audience

Phase 0 skeleton for the **two-audience reference app** ([epic #255](https://github.com/suleimansh/vike-data/issues/255)).

This is the harness, not the feature. It stands up a React app on the **memory adapter**
(zero database) with a **single audience** for now: vike-auth's default `User`/`users`
guard, used as-is. It proves the app builds and runs, and gives the later phases a real
place to land. The second guard (staff + customer), org ownership, and the Vue twin come in
follow-up phases; there are no `vike-auth` changes here.

## What's wired

- **vike-react** — the React renderer.
- **vike-auth/react** — the keystone. One install brings the magic-link server tier, the
  auth strings, and the extension-owned `/login` + `/account` pages. The single (default
  user) audience that Phase 1 will split into two guards.
- **vike-themes/react + vike-theme-emerald** — a brand (light + dark) plus the
  `system`/`light`/`dark` appearance axis.
- **vike-layouts/react** — the app shell (`topbar` here; `/login` uses its own `centered`
  shell).

The `users`/`sessions` rows live in an in-process memory adapter registered in
`pages/+onCreateGlobalContext.js`, seeded with one user (`ada@example.com`). Sign in with
the magic link printed to the dev console; the seeded row is reused (looked up by email).

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter app-two-audience dev
```

Then open http://localhost:4300 (distinct from `app-react` on 4100 and `app-vue` on 4200).
