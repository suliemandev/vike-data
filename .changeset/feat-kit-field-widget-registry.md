---
'@vike-data/kit': minor
'vike-storage': minor
'vike-admin': patch
---

Cross-extension field widgets through a shared registry in `@vike-data/kit` (Option D, #185). kit gains `createFieldWidgetRegistry(name)`, a per-framework token to component map (components held as opaque values, like `createPort` holds providers, kept on globalThis so module duplication can't fork it). vike-admin's `widget-registry.js` now creates the shared `'react'` registry from kit instead of owning a private `Map`; its public surface (`registerFieldWidget` / `getFieldWidget` / `fieldWidgetTokens`) is unchanged. vike-storage registers its `file` widget into the same shared registry directly, so it depends only on kit and no longer on vike-admin: neither core knows about the other, and any future consumer of the registry (a `vike-landing`, a `vike-email-editor`) renders `.as('file')` with no per-consumer bridge.

vike-storage's admin-specific bridge is replaced by a consumer-neutral React surface: the `vike-storage/react-admin` subpath becomes `vike-storage/react` (a `+config.js` contributing the registration Layout), `react/AdminFileRegister` becomes `react/FieldWidgetRegister`, and `vike-admin` is removed from vike-storage's optional peer dependencies. Apps swap the `extends` entry from `storageAdminExt` (`vike-storage/react-admin`) to `storageReactExt` (`vike-storage/react`).
