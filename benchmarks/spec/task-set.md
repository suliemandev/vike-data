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
| 004 | stripe | gate note creation behind a paid plan | vike-stripe composes checkout + webhook; Next hand-wires the Stripe SDK | **needs a decision** (webhook simulation) |
| 005 | ai | ask a question about a note | vike-ai `generate()` is already the seam; Next wires a provider call | yes, via the deterministic stub provider |

## Status

- **001 tags** — shipped. The no-edge guard.
- **002 magic-link** — shipped. `POST /api/auth/magic-link` returns a dev token,
  `POST /api/auth/magic-link/redeem` opens the same session; single-use; password login
  untouched. See `task-002-magic-link.md`.
- **003 notifications** — shipped. Creating a note produces one notification;
  `GET /api/dev/outbox` returns the captured messages (both apps expose a dev sink so delivery
  is graded offline, no real email). See `task-003-notifications.md`.
- **004 stripe** — planned, **open question below**.
- **005 ai** — shipped. `POST /api/notes/:id/ask { question }` → `200 { answer }`, answered
  through the app's AI layer against the deterministic stub provider. The gate is behaviour-level
  (non-empty, deterministic, gated, 404 on absent) — it measures the effort to wire a new AI
  call, not model quality. See `task-005-ai.md`.

## Open question — grading the Stripe task (004) offline

Stripe's real value (checkout + webhooks) is awkward to auto-grade without network and a
webhook tunnel. Two options:

1. **Simulated event** (recommended): the contract adds `POST /api/dev/billing/activate
   { email }` that stands in for the `checkout.session.completed` webhook, flipping the user to
   paid. The task is then "gate `POST /api/notes` to paid users; expose checkout; flip to paid
   on the billing event." Accept: unpaid create → `402`; after the simulated event → `201`.
   Fully offline, still exercises the gating + webhook-handling the extension composes.
2. **Stripe test mode**: real test keys + the Stripe CLI to forward a webhook. Most faithful,
   but needs credentials and network in the runner — fails the "reproducible, offline" rule.

Leaning option 1 for the committed baseline, with option 2 as an opt-in real-mode variant.

## Open question — task scope (3 vs 5)

#330 carries a focused-3 vs full-5 call (align with the maintainer on what is published and
best shows composition). 001 + 002 are in; 003/005 are offline-gradeable; 004 needs the
decision above. The runner (Phase 3) iterates whatever tasks exist, so the set can grow
incrementally.
