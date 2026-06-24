---
'vike-storage': minor
---

vike-storage: the client upload control + the vike-admin `file` widget (completes the uploads vertical). Framework-agnostic helpers (`vike-storage/client`: `uploadFile` / `deleteUpload`) with thin React (`vike-storage/react/FileUpload`) and Vue (`vike-storage/vue/FileUpload`) controls, none importing the server module. A `vike-storage/react-admin` bridge registers a `FileField` into vike-admin's field-widget registry, so a column declared `.as('file')` renders an uploader in the admin form with no bespoke admin code (the live proof that the widget registry is third-party-extensible). The bridge is a passthrough vike-react Layout, so the widget is registered in both the SSR and client bundles (no hydration mismatch). The Vue admin widget follows once vike-admin ships a Vue widget registry; the standalone Vue control works today.
