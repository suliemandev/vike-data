---
'vike-admin': patch
---

Make vike-admin's **Vue** binding a true preset over vike-view/vue, removing the duplicated list/form UI (#395) — the Vue mirror of #378:

- **vike-admin/vue/FormFields** now re-exports vike-view/vue's `FormFields`, which dispatches through the shared Vue field-widget registry, instead of an inline `v-if` switch. So an extension's Vue control (e.g. vike-storage's `file` widget) renders in the admin form too, and the built-in semantic widgets (email / longtext / enum / json / date) come from one place.
- **vike-admin/vue/ListPage** renders its table THROUGH vike-view/vue's `ListView` (FK cell labels, sortable-header links via `sortHref`, a per-row edit link via `rowHref`) instead of a second table implementation, keeping only the admin chrome (title, New button, paging).

No behavior change for vike-admin (its 68 data-layer tests stay green); verified via a Vue SSR proof that the compiled `.vue` pages render the list + forms through the shared components (enum → `<select>`, FK label not raw key, edit prefill). Layering now matches React: vike-blocks/vue ← vike-view/vue ← vike-admin/vue.
