---
'vike-push': minor
---

Add vike-push, the Web Push channel (server core). `sendPush(userId, payload)` delivers to every subscription a user has, over vike-queue, through a swappable push transport (a console/outbox default in dev, a Web Push/VAPID transport in prod). vike-push owns the `push_subscriptions` table and a `/push/subscribe` + `/push/unsubscribe` endpoint bound to the signed-in user. The second channel after vike-mail; same neutral-port shape. The per-framework client control + service worker and a real VAPID transport follow in a later change.
