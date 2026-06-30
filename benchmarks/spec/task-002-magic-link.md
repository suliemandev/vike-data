# Task 002: add passwordless magic-link login

The **auth** task, and a deliberate differentiator. The baseline signs in with email +
password. This task asks the agent to add a **passwordless magic-link** sign-in *alongside*
the existing password login, without breaking it.

On the Vike side this is a near-zero-code change: `vike-auth` is passwordless by design and
already ships `requestMagicLink` / `redeemMagicLink` plus a `/login` page. On the Next.js
side the agent wires Auth.js's email provider (provider + adapter + callbacks + a dev mail
sink). Same observable contract on both, so one acceptance script grades either.

## Agent prompt (verbatim, given on both apps)

> Add passwordless "magic link" sign-in alongside the existing password login. A user enters
> their email, the app issues a single-use, short-lived login token (in production it would be
> emailed; in development the request returns the token so it can be tested), and redeeming
> that token signs the user in by opening the same session the password flow uses. Keep the
> existing password login and the rest of the HTTP contract working, and extend the contract
> exactly as described in the acceptance criteria.

## Required contract changes (additive — nothing existing changes)

- `POST /api/auth/magic-link` with `{ email }` → `200 { token: string }`. The `token` is the
  value the magic-link email would carry. Returning it in the response is a **development /
  benchmark test affordance** (both apps expose it); a production build would email it
  instead. Unknown emails still return `200` with a token-shaped response (no account-existence
  oracle).
- `POST /api/auth/magic-link/redeem` with `{ token }` → `200 { ok: true }` and a session
  cookie (the **same** cookie the password login sets). `401` on an invalid, expired, or
  already-used token.
- After redeeming, the session authorizes the existing protected endpoints (`GET /api/notes`
  etc.), exactly like a password login.
- The token is **single use**: redeeming the same token twice fails the second time.
- `POST /api/login` (password) keeps working unchanged.

## Acceptance criteria (checked by `tasks/task-002-magic-link/accept.mjs`)

1. `POST /api/auth/magic-link { email: demo@example.com }` returns `200` with a non-empty `token`.
2. `POST /api/auth/magic-link/redeem { token }` returns `200 { ok: true }` and sets a session cookie.
3. With that cookie, `GET /api/notes` returns `200` (the magic-link session authorizes the app).
4. `POST /api/auth/magic-link/redeem { token: "bogus-token" }` returns `401`.
5. Redeeming the **same** valid token a second time returns `401` (single use).
6. The existing password login still works: `POST /api/login { demo@example.com / password }` → `200`.

The script exits `0` only when all checks pass.

## Guardrails

- Hard timeout: 30 minutes wall clock.
- Max interventions before DNF: 5.
- A login UI must offer the magic-link option (spot-checked by the human); the automated gate
  is the contract above.

## v2 correctness gate: no account-existence oracle (`tasks/task-002-magic-link/auth-gate.mjs`)

`accept.mjs` checks single-use. This additive gate (methodology v2, issue #359) checks the
property a hand-roll most often skips: requesting a magic link for an **unknown** email must
return the same token-shaped `200` as a known one. Otherwise the endpoint is a user-enumeration
oracle (request a link, observe whether it "worked"). Scored pass/fail, above minutes.

vike-auth passes for free — `requestMagicLink` issues for any syntactically-valid email and
find-or-creates the user at redeem, so it has no existence signal. A hand-roll that issues a
token only for known users — a natural shortcut — fails. The token expiry + single-use + token
store + find-or-create that vike-auth also gives free are the **burden** v2 counts on the Next
side (it hand-wrote all of them).
