# Task 004: gate note creation behind a paid plan

The **stripe** task. Note creation should require a paid plan: an unpaid user is refused, can
start checkout, and is flipped to paid by the billing event. On the Vike side `vike-stripe`
composes the checkout session + webhook handling; on the Next.js side the agent hand-wires the
Stripe SDK (checkout session + webhook route) plus the dev activation sink.

Stripe's real value (hosted checkout + signed webhooks) needs network and a webhook tunnel,
which breaks the offline/reproducible rule. So this task grades the **gating + event handling**
the extension composes, with a **simulated** billing event: a dev-only endpoint stands in for
`checkout.session.completed` and flips the user to paid. (A real Stripe test-mode variant is an
opt-in, later concern, not part of the committed baseline.)

## Agent prompt (verbatim, given on both apps)

> Put note creation behind a paid plan. The seeded user starts on the free plan. While unpaid,
> `POST /api/notes` must be refused with `402` and must not create a note. Add
> `POST /api/billing/checkout`, which starts a Stripe checkout for the upgrade and returns the
> checkout URL. In production a Stripe webhook (`checkout.session.completed`) marks the user
> paid; in development expose `POST /api/dev/billing/activate { email }` that stands in for that
> webhook and flips the user to paid. Once paid, `POST /api/notes` works again (`201`). Keep the
> rest of the existing HTTP contract working.

## Required contract changes (additive)

- `POST /api/notes` is now **gated**: for an unpaid signed-in user it returns `402` and creates
  **no** note. For a paid user it behaves exactly as before (`201 { note: Note }`).
- `POST /api/billing/checkout` → `200 { url: string }`. Starts the upgrade checkout and returns
  the checkout URL (a non-empty string). Offline this is the URL Stripe would redirect to; its
  exact value is not graded, only that a URL is returned.
- `POST /api/dev/billing/activate { email }` → `200 { ok: true }`. The **dev / benchmark**
  stand-in for the `checkout.session.completed` webhook: it marks the named user paid. No real
  Stripe call is made.
- The seeded user (`demo@example.com`) starts **unpaid**. Other endpoints are unchanged.

## Acceptance criteria (checked by `tasks/task-004-stripe/accept.mjs`)

1. Log in as the seeded user.
2. `POST /api/notes` while unpaid → `402` (and the create is refused).
3. `GET /api/notes` count is unchanged by the refused create (no note leaked).
4. `POST /api/billing/checkout` → `200` with a non-empty `url` string.
5. `POST /api/dev/billing/activate { email: demo@example.com }` → `200`.
6. `POST /api/notes` now → `201 { note }`, and `GET /api/notes` shows exactly one more note.

The script exits `0` only when all checks pass.

## Guardrails

- Hard timeout: 30 minutes wall clock.
- Max interventions before DNF: 5.
- Billing is graded through the simulated activation endpoint; no real Stripe call, key, or
  network is required. A real test-mode run is an opt-in variant, outside the committed baseline.
