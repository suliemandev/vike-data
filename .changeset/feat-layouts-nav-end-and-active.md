---
'vike-layouts': minor
---

vike-layouts: trailing nav items + active-item styling in the app shells (#303).

- **Trailing items.** A nav item may now carry `{ end: true }`. The `topbar` shell renders these on the far side next to `userMenu` (e.g. Account / Login on the right); the `sidebar` shell sinks them to the bottom above `userMenu`. One `nav` array, no new slot. An app that sets no `end` is byte-for-byte unchanged.
- **Active item.** The link matching the current page is rendered full-contrast + bold with `aria-current="page"`; the rest stay muted. The match is a new framework-agnostic core export `isActivePath(currentPath, href)` (root `/` exact-only; every other href stays active on its descendants, so `/admin` highlights on `/admin/users`; trailing slash / query / hash ignored). `NavList` reads the current path from pageContext, so it tracks the server render and every client-side navigation with no per-page wiring.

Both behaviours land in the React and Vue bindings together (`NavList`, `TopbarShell`, `SidebarShell`).
