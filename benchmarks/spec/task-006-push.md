# Task 006: web-push subscriptions (subscribe / list / unsubscribe)

The **push** task. The app lets a signed-in user register a web-push subscription, list their own
subscriptions, and unsubscribe one. On the Vike side `vike-push` composes the subscription store
and the `/push/*` endpoints; on the Next.js side the agent hand-wires a `push_subscriptions` table
plus the three routes.

Real web push needs VAPID keys and a browser push service, which breaks the offline/reproducible
rule. So this task grades the **subscription store + ownership**, not delivery: a subscription is
just a `{ endpoint, keys }` record the app persists for the current user. Sending is out of scope
(task-003 already covers the notification/delivery seam).

This is the first task whose **natural** hand-rolled implementation is *insecure*. The unsubscribe
payload carries only `{ endpoint }` (that is all the browser's `PushSubscription` exposes, and it
is what `vike-push`'s own client sends), and `endpoint` is globally unique. So the idiomatic Next
implementation is `DELETE FROM push_subscriptions WHERE endpoint = ?` — correct for the happy path,
and an **IDOR**: any signed-in user who knows another user's endpoint can unsubscribe them. Scoping
the delete to `... AND user_id = ?` requires the agent to think about the cross-user attack, which
the happy-path contract never forces. `vike-push` is scoped to the owner by construction
(`removeSubscription(userId, endpoint)` → `delete({ endpoint, user_id })`), so it passes the gate
for free; this is the exact bug class of repo issue #171, fixed in `vike-push` before it shipped.

## Agent prompt (verbatim, given on both apps)

> Let a signed-in user manage web-push subscriptions for their account. Add
> `POST /api/push/subscribe { endpoint, p256dh?, auth? }` that stores a push subscription for the
> current user (re-subscribing the same endpoint for the same user just updates it, not a
> duplicate); `GET /api/push/subscriptions` that returns the current user's own subscriptions; and
> `POST /api/push/unsubscribe { endpoint }` that removes one of the current user's subscriptions.
> A second user `other@example.com` / `password` is seeded alongside `demo@example.com`. Keep the
> rest of the existing HTTP contract working.

## Required contract changes (additive)

- A **second** user is seeded: `other@example.com` / `password` (alongside `demo@example.com`).
  Both can sign in via `POST /api/login`. Everything else about auth is unchanged.
- `POST /api/push/subscribe { endpoint, p256dh?, auth? }` → `201 { ok: true }`. Stores a push
  subscription owned by the signed-in user. Re-subscribing the same `endpoint` for the same user
  updates in place (no duplicate). Requires a session (`401` otherwise).
- `GET /api/push/subscriptions` → `200 { subscriptions: Array<{ endpoint: string }> }`. The signed-in
  user's **own** subscriptions only. Requires a session.
- `POST /api/push/unsubscribe { endpoint }` → `200 { ok: true }`. Removes the signed-in user's
  subscription for that `endpoint`. Must affect **only the caller's own** subscription. Requires a
  session.

## Acceptance criteria (checked by `tasks/task-006-push/accept.mjs`)

1. Log in as the seeded user.
2. `GET /api/push/subscriptions` → `200` with a `subscriptions` array.
3. `POST /api/push/subscribe` with endpoint `E1` → `201`; the list now includes `E1` (one more).
4. `POST /api/push/subscribe` with endpoint `E2` → `201`; the list now includes both (one more).
5. Re-subscribing `E1` does **not** add a duplicate (count unchanged).
6. `POST /api/push/unsubscribe { endpoint: E1 }` → `200`; the list no longer includes `E1`, `E2`
   still present.

The script exits `0` only when all checks pass.

## Guardrails

- Hard timeout: 30 minutes wall clock.
- Max interventions before DNF: 5.
- Push is graded as a stored subscription record; no VAPID key, browser push service, or network is
  required. Delivery is out of scope (task-003 covers the notification seam).

## v2 correctness gate: ownership / IDOR (`tasks/task-006-push/push-gate.mjs`)

The criteria above grade the happy path on a single user, which a `DELETE ... WHERE endpoint = ?`
implementation passes — faster — because one user's flow never exercises ownership. This **additive**
gate (methodology v2, issue #359) grades the security property the extension actually owns. It is
scored **pass/fail, above minutes**.

The gate uses both seeded users:

1. User **B** (`other@example.com`) subscribes endpoint `EB`; confirm B's list includes `EB`.
2. User **A** (`demo@example.com`) subscribes endpoint `EA`.
3. While signed in as **A**, `POST /api/push/unsubscribe { endpoint: EB }` (B's endpoint). The
   response may be `200` (idempotent) or `404`; either is fine — what matters is the effect.
4. **B's `EB` subscription must still exist** (sign back in as B; the list still includes `EB`). A
   delete-by-endpoint implementation removes it here and **fails**.
5. Sanity: as **A**, unsubscribing **A's own** `EA` still works (the endpoint is functional), and B's
   `EB` is unaffected.

`vike-push` passes for free — `removeSubscription(userId, endpoint)` deletes
`{ endpoint, user_id }`, so a cross-user unsubscribe is a no-op. A hand-rolled
`DELETE ... WHERE endpoint = ?` **fails step 4**: passing it requires the agent to additionally scope
the delete (and the list, and re-subscribe) to `user_id`. That ownership scoping is the
bespoke-decision burden v2 counts, and the correctness the happy-path contract could not see.
