# Benchmark methodology v2: measure what composition is actually good at

The first measurement session (tasks 002 auth, 003 notifications, 004 stripe; see
`runner/baseline.json`) produced a clear, useful, **negative** result: with an expert agent
and the current metrics, the `vike-*` family is **net slower** than hand-wiring Next.js, and
the gap *widens* on the more integration-heavy task — the opposite of the composition thesis.

| Task | vike | next | Δ (vike − next) |
|---|---|---|---|
| auth (magic-link) | 3.2m / 0 | 3.5m / 0 | −0.3m |
| notifications | 3.0m / 0 | 2.1m / 0 | +0.9m |
| stripe | 3.9m / 0 | 2.0m / 0 | +1.9m |
| **total** | **10.1m / 0** | **7.6m / 0** | **+2.5m** |

This is not a verdict on the framework. It's a verdict on the **measurement**. v2 fixes the
measurement.

## Why v1 doesn't differentiate

1. **The agent is an expert.** Hand-rolling a single-use token or a `paid` flag is trivial for
   an agent that already knows the pattern. Composition can't beat "trivial" on wall-clock.
   v1's headline metric (minutes) has no signal when the floor is already low.

2. **The grading is happy-path and offline.** `accept.mjs` checks the contract works, not that
   it works *correctly under adversarial input*. The extensions' real value is exactly the
   adversarial part:
   - vike-auth: single-use **and** expiry **and** no account-existence oracle.
   - vike-mail: a transport **swap** (dev outbox → Resend) with no caller change; ret/idempotency.
   - vike-stripe: a **signed** webhook — a forged/unsigned event must not grant access; idempotent
     upsert; stale-event drop.
   v1 grades none of these, so a minimal hand-roll that skips them **scores identically**.

3. **0 interventions either way.** An autonomous expert needs no human, so the intervention
   axis is flat. It would move for a weaker agent — which v1 never runs.

The stripe task is the proof: its offline **simulated** activation endpoint bypasses the signed
webhook entirely, so vike-stripe's whole reason to exist never executes, and a hand-rolled
`paid` flag is both correct *and* faster.

## v2: three additions

### A. Adversarial correctness gates (the core fix)

Add, per task, checks the composed extension passes for free but a minimal hand-roll fails.
Scored pass/fail, **weighted above minutes**. Flagship examples:

- **auth**: an **expired** token redeems → `401`; requesting a link for an unknown email returns
  a token-shaped `200` (no existence oracle). (Single-use is already in v1.)
- **stripe**: POST the webhook an **unsigned/forged** event → it must be **rejected** and must
  **not** flip the user paid; a correctly **signed** event (built with the extension's own
  signer) → accepted. This single check is the whole differentiator: vike-stripe verifies the
  signature; a hand-rolled dev-activate does not, and fails.
- **notifications**: swap the transport to a recording fake → the **producer code is unchanged**
  (proves the seam), and a duplicate delivery is not double-sent.

A task's score is `correctness-gates-passed / total`, then minutes as a tiebreaker. "Fast but
insecure" stops winning.

### B. A code/decision-burden proxy

Alongside minutes, record the count of **bespoke security/correctness decisions** the agent had
to make unaided — single-use consume, expiry, signature verification, idempotency key, no-oracle.
Each is a latent bug the extension removes. This is the thing that *doesn't* show up in minutes
but is the real cost of hand-wiring. Recorded by the human at grading time (small integer).

### C. An agent-capability axis

Run the same tasks with a **weaker/cheaper model** (the "junior engineer" proxy). The thesis is
really *composition lowers the floor* — it helps the agent that can't already hand-roll a signed
webhook correctly. Expert agents have a high floor, so they're the **worst** case for the thesis;
v1 only ran the worst case. Report both tiers.

## What stays

Offline reproducibility, the shared HTTP contract, the objective accept gate, the real Next.js
ecosystem, and the no-edge guard (task 001). v2 is additive: same harness, richer gates.

## Revised score

Per task, per (framework, agent-tier):
`correctness = gates_passed / gates_total` (primary) · `minutes` (tiebreaker) · `interventions`
· `burden` (bespoke-decision count). A framework "wins" a task by being **correct first**, then
fast. Composition should win on correctness even where it ties or loses on minutes — which is the
honest claim, and the one v1 couldn't make.
