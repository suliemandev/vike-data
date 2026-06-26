---
'@vike-data/vike-notifications': patch
---

vike-notifications: `notify()` now dispatches only the notifiable's routable fields (`id`, `email`) instead of the whole hydrated user row. The vike-queue driver persists the job payload (JSON in the jobs table), so dispatching the full row wrote every column — including `password_hash` and any other secret the app added to its users table — into durable storage, where it lingered after delivery and in failed-job rows. Channels only ever read the route field via `routeFor()`, and rendering still runs against the full user before dispatch, so nothing downstream changes.
