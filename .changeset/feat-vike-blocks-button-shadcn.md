---
'vike-blocks': minor
---

Update the **`button`** block to the shadcn Base button surface (#412 follow-up, #428). The variant set is now the shadcn one — `default` / `secondary` / `outline` / `ghost` / `link` / `destructive` — with four sizes (`sm` / `default` / `lg` / `icon`), a `:focus-visible` ring, a hover state, and a disabled state (`.disabled()`, or `disabled` on the descriptor). A disabled link-button (`.to()`) is marked `aria-disabled`, dropped from the tab order, and won't navigate.

Back-compat: our historical names alias onto the new set, so existing configs render unchanged — variant `primary` -> `default`, `danger` -> `destructive`, and size `md` -> `default`.

Still theme-native (`var(--color-*)` / `--radius`) and dep-free: the interactive states ride a small shared `<style>` tag + a `--btn-bg-hover` custom prop, so no inline `:hover`/`:focus` is needed. The variant/size tables live in a shared `button-styles` module that both the React and Vue renderers import, so the two can't drift. Updated the `/button` demo (all variants/sizes/disabled) and extended the unit tests (aliasing + the states style tag).
