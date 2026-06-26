---
'vike-notifications': minor
---

vike-notifications: generalize the notifiable beyond User (#206). `routeFor(notifiable, channel)` now consults an explicit `routes` map on the notifiable before the user-field convention (mail -> `.email`, push -> `.id`), so a non-User target is handled in the one routing seam every channel already goes through, never a breaking change across adapters. A new `route({ mail, push, ... })` helper builds an on-demand (anonymous) notifiable delivered to explicit addresses with no stored user and no in-app feed row (a guest-checkout receipt, a contact-form auto-reply, an ops alert). The route is plain data, not a Laravel-style `routeNotificationFor()` method, because the notifiable is serialized into the vike-queue delivery payload where a method would not survive; the projection carries the `routes` map through so the worker resolves it. The in-app `database` feed stays user-scoped by design. With no `routes` set, behaviour is byte-for-byte unchanged.
