---
'@vike-data/kit': minor
---

kit: add `createDevTransport({ name, entry, line })`, the zero-config "console + outbox" transport a channel falls back to when no real transport is registered. It bundles `createOutbox` with the record-and-log pattern that vike-mail and vike-push had each duplicated: `send(...args)` records `entry(...args)` to the outbox and logs `line(...args)`, and it returns `{ getOutbox, clearOutbox, transport }` so a channel registers `transport` as its port's `default` and re-exports the outbox accessors under its own names. vike-mail and vike-push now build their dev transport from it (no behavior change).
