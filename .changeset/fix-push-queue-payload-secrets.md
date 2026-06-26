---
'@vike-data/vike-push': patch
---

vike-push: the send job now carries only the subscription's id, not its encryption material. Previously `sendPush` dispatched `{ subscription: { endpoint, keys: { p256dh, auth } } }`, and since the vike-queue driver persists the job payload (JSON in the jobs table), the per-subscription RFC 8291 `auth` secret was written to durable storage. The handler now re-reads the subscription row at run time and reconstructs the keys there (which also picks up refreshed keys), so the secret never enters the persisted payload. A subscription removed before the worker runs is a no-op.
