---
'vike-stripe': patch
---

vike-stripe: three webhook state-transition correctness fixes (the signature verification was already sound; these are about applying a verified event to stored state).

1. **Out-of-order subscription events no longer re-grant access.** `applySubscriptionEvent` upserted unconditionally, so a delayed/retried `active` event arriving after a `canceled` one silently overwrote the newer state and re-granted paid access. When the event carries `occurredAt` and a stored timestamp exists, a strictly older event is now dropped as stale (returns `{ ok: true, stale: true }`). An event with no timestamp still applies, so the single-stream upsert is unchanged.

2. **Only succeeded charges are recorded.** `recordCharge` inserted a `payments` row for any event (`status: event.status ?? 'succeeded'`), so a `payment_intent.payment_failed` / refunded / pending event produced a row an app could read as proof of payment. It now ignores a non-success status or event type with a 200 (`{ ok: true, ignored: true }`), and `paymentsFor` filters on `status: 'succeeded'`.

3. **Idempotency leans on the unique constraint.** The find-then-insert raced two concurrent deliveries of the same intent into a double-insert (or an uncaught unique-violation 500 on a real DB). The insert is now wrapped to catch the duplicate-key error and return the existing row, so a concurrent duplicate stays idempotent.
