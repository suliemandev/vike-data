---
'vike-blocks': patch
'vike-view': patch
---

React packaging consistency with the family (vike-auth pattern):

- Declare `vue` / `vike-vue` as optional peer dependencies alongside `react` / `vike-react`, since these packages host both framework bindings as subpaths (the Vue binding is a fast-follow).
- Add granular per-component subpath exports (`vike-blocks/react/registry`, `vike-blocks/react/Blocks`, `vike-view/react/ListView` / `RecordView` / `FormView`) so a component can be imported directly and referenced by a Vike pointer-import, matching how vike-auth exposes `./react/LoginPage` etc.

No runtime change; `./react` still re-exports everything.
