---
'vike-auth': minor
'vike-themes': minor
'vike-layouts': minor
'vike-i18n': minor
'vike-admin': minor
'vike-toolbar': minor
---

Add Vue 3 bindings as `vike-*/vue` subpaths, mirroring the existing `vike-*/react` layout. Each package now ships its UI as `.vue` SFCs under a `vue/` subpath: vike-auth (login + account pages, sign-in form, user button), vike-themes (theme provider + picker), vike-layouts (the topbar/sidebar/centered shells), vike-i18n (locale provider + picker), vike-admin (the dashboard/list/new/edit pages), and vike-toolbar (the settings popover). Install the extension and import the subpath for your framework; the framework-agnostic cores are unchanged. Verified against a new Vue demo app (app-vue), the twin of app-react.

Note for Vue: vike-vue has no `Wrapper` config (only the cumulative `Layout`), so the theme, locale, and toolbar providers are contributed via `Layout`; they nest and compose with the shell layout.
