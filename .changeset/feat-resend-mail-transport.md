---
'vike-mail': minor
---

feat: add a Resend production mail transport (`vike-mail/resend`). vike-mail shipped only the dev console/outbox transport; this is the first real one. The app registers it once, `setMailTransport(resendTransport({ apiKey, from }))`, and every `sendMail` (magic links, stripe notifications, ...) delivers over Resend's HTTP API with no caller change. It is an opt-in subpath so the neutral port stays provider-free unless an app asks for it, and it is server-only (it carries the API key). Delivery still runs through vike-queue, so a transient failure is retried per `sendMail`'s `maxAttempts`; the transport throws on a non-2xx (surfacing Resend's status + message) so the queue can see the failure. A per-message `from` overrides the transport default; `fetch` and `baseUrl` are injectable for testing.
