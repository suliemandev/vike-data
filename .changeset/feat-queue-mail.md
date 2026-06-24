---
'vike-queue': minor
'vike-mail': minor
'vike-auth': minor
---

Add vike-queue (a background-job seam) and vike-mail (a neutral mail port), and route vike-auth's magic link through them.

vike-queue: a runtime job registry + `dispatch(job, payload)` over a swappable driver. The inline driver (dev default) runs work immediately with retry/backoff; the database driver persists to a `jobs` table (universal-orm) for a worker to drain. Other extensions queue work onto it.

vike-mail: `sendMail({to, subject, html})` plus a swappable transport (the mail twin of `@universal-orm/core`). Producers depend on the neutral port; the app registers the transport (console/outbox in dev, Resend/SES/SMTP in prod). Sending runs through vike-queue.

vike-auth: the magic link is now delivered through vike-mail's port instead of a bare console.log. With no transport registered the dev outbox/console records it (today's behavior, now routed through the seam); registering a real transport makes it actually email. vike-auth depends only on the neutral port, never a concrete provider.
