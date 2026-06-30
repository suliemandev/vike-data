# Benchmark task set

The task set is what makes the benchmark *differentiate*. Phase 0 proved a plain CRUD task
(add tags) is fast and intervention-free on both stacks, so the set leans on tasks where the
`vike-*` extensions compose and the Next.js side hand-integrates an unrelated library. One
task is deliberately a no-edge guard (anti-cherry-pick).

Each task ships: a verbatim agent prompt (given on both apps), an additive contract change, an
objective `accept.mjs`, a starting commit (current `main`), the shared intervention rubric,
and a 30-minute / 5-intervention cap.

| # | Extension | Task | Differentiation | Auto-gradeable offline |
|---|---|---|---|---|
| 001 | data (none) | add tags + filter | **no edge** (the guard) — both fast | yes (done) |
| 002 | auth | passwordless magic-link login | vike-auth has it built-in; Auth.js needs an email provider + adapter + callbacks | yes (done) |
| 003 | notifications | email the user when a note is created | vike-notifications/vike-mail self-wire (dev outbox); Next hand-wires Resend | yes, via a dev outbox endpoint |
| 004 | stripe | gate note creation behind a paid plan | vike-stripe composes checkout + webhook; Next hand-wires the Stripe SDK | yes, via a simulated activation event |
| 005 | ai | ask a question about a note | vike-ai `generate()` is already the seam; Next wires a provider call | yes, via the deterministic stub provider |
| 006 | push | subscribe / list / unsubscribe web push | vike-push owns the subscription store + an ownership-scoped unsubscribe; Next hand-wires a table, and the natural `DELETE WHERE endpoint = ?` is an IDOR | yes, via a stored subscription record + an ownership gate |

## Status

- **001 tags** — shipped. The no-edge guard.
- **002 magic-link** — shipped. `POST /api/auth/magic-link` returns a dev token,
  `POST /api/auth/magic-link/redeem` opens the same session; single-use; password login
  untouched. See `task-002-magic-link.md`.
- **003 notifications** — shipped. Creating a note produces one notification;
  `GET /api/dev/outbox` returns the captured messages (both apps expose a dev sink so delivery
  is graded offline, no real email). See `task-003-notifications.md`.
- **004 stripe** — shipped. Note creation is gated behind a paid plan: unpaid `POST /api/notes`
  → `402`; `POST /api/billing/checkout` → `200 { url }`; `POST /api/dev/billing/activate
  { email }` stands in for the `checkout.session.completed` webhook and flips the user to paid,
  after which create → `201`. Graded offline via the simulated event. See `task-004-stripe.md`.
- **005 ai** — shipped. `POST /api/notes/:id/ask { question }` → `200 { answer }`, answered
  through the app's AI layer against the deterministic stub provider. The gate is behaviour-level
  (non-empty, deterministic, gated, 404 on absent) — it measures the effort to wire a new AI
  call, not model quality. See `task-005-ai.md`.
- **006 push** — shipped. A signed-in user manages web-push subscriptions:
  `POST /api/push/subscribe`, `GET /api/push/subscriptions`, `POST /api/push/unsubscribe`. A second
  user (`other@example.com`) is seeded so ownership can be tested. The v2 gate is an IDOR check: A
  must not be able to unsubscribe B by endpoint. vike-push's owner-scoped delete passes free; the
  natural hand-rolled delete-by-endpoint fails. See `task-006-push.md`.

## Resolved — grading the Stripe task (004) offline

**Decision: simulated event** (option 1). The contract adds `POST /api/dev/billing/activate
{ email }` that stands in for the `checkout.session.completed` webhook, flipping the user to
paid. The task is "gate `POST /api/notes` to paid users; expose checkout; flip to paid on the
billing event." Accept: unpaid create → `402`; after the simulated event → `201`. Fully offline,
still exercises the gating + webhook-handling the extension composes. A real Stripe test-mode
run (real keys + Stripe CLI webhook forward) stays an opt-in variant, outside the committed
baseline.

## Resolved — task scope (3 vs 5)

**Decision: full 5** (auth / data / notifications / stripe / ai). 001 is the no-edge guard;
002/003/004/005 each lean on an extension and are offline-gradeable. The runner (Phase 3)
iterates whatever tasks exist, so the set can still grow, but the committed baseline targets all
five.
