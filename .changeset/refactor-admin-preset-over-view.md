---
'vike-view': minor
'vike-admin': patch
---

Make vike-admin a true preset over vike-view's React renderers, removing the duplicated list/form UI (#378):

- The field-widget layer (the built-in controls + the `registerFieldWidget`/`getFieldWidget` registry + the `FormFields` dispatcher) now lives in **vike-view/react**. vike-admin re-exports it, so `vike-admin/react/widgets` etc. are unchanged; both bind kit's shared `react` slot, so a control registered on either side (or by an extension like vike-storage's `file`) is visible to both.
- **vike-view/react/FormView** now dispatches its controls through that shared registry instead of a private inline switch — so a vike-view form renders the full set of semantic widgets (email / longtext / enum / json / date / file), not just a minimal set.
- **vike-view/react/ListView** grew the options a full admin list needs (FK cell labels, sortable-header links via `sortHref`, a per-row action link via `rowHref`), all optional, so vike-admin's `ListPage` renders its table THROUGH ListView (keeping its own chrome: title, New button, paging) instead of a second table implementation.

No behavior change for vike-admin (its 68 tests, all on the data layer, stay green); the list and forms render as before, now from one shared set of components.
