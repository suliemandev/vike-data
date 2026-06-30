# Results: `vike-*` extensions vs Next.js, built by an AI agent

The same Notes app, built by the same AI agent (same model) on two stacks: the Vike
`vike-*` extension family, and an idiomatic Next.js stack using its real ecosystem
(Auth.js, Prisma, Resend, Stripe SDK). Six tasks, one per extension. Full method in
[`README.md`](./README.md); raw numbers in [`runner/baseline.json`](./runner/baseline.json).

## The takeaway

**Speed is about even. Safety is not.** And on one task, the fast Next path is an actual
shipped vulnerability.

Building the same app, the agent makes **~0 bespoke security decisions** on the Vike
stack vs **~11** on Next. On Vike it reuses extension seams (signed webhooks, single-use
+ expiry login tokens, no account-existence oracle, owner-scoped unsubscribe); on Next it
hand-writes each one. Every hand-written one is a place to get security wrong, and on the
**push** task it does: the natural hand-rolled unsubscribe is a cross-user IDOR that
**fails the gate**, while `vike-push` passes it for free.

## The numbers (6 tasks)

| Task | Extension | vike | next |
|---|---|---|---|
| auth (magic link) | vike-auth | 1/1 gate · 3.2m · **0** burden | 1/1 gate · 3.5m · **4** burden |
| notifications | vike-mail | 2.2m · **0** burden | 2.1m · **2** burden |
| stripe (paid gate) | vike-stripe | 1/1 gate · 2.0m · **0** burden | 1/1 gate · 2.6m · **4** burden |
| ai (ask a note) | vike-ai | 1.6m · **0** burden | 1.8m · **1** burden |
| data (tags) | universal-orm | 2.6m · **0** burden | 2.7m · **0** burden |
| push (subscribe) | vike-push | **1/1** gate · 2.2m · **0** burden | **0/1** gate · 1.9m · **0** burden |
| **Total** | | **13.8m · 0 burden** | **14.6m · 11 burden** |

0 human interventions on either side, every task. `gate` = a v2 adversarial correctness
check (e.g. an unsigned Stripe webhook must be rejected; one user must not unsubscribe
another); `burden` = bespoke security/correctness decisions the agent made unaided, a
latent-bug proxy.

Read it as: **minutes tie, the agent ships ~11 security-sensitive bits by hand on Next
and ~0 on Vike — and on push, one of those bits is a live IDOR that fails the gate.**

## How we got here (the honest part)

The first cut measured **minutes only**, and Vike looked *slower*, worst on Stripe. Two
fixable reasons, not a verdict:

1. **The metric was blind.** Minutes don't see that the fast Next path hand-rolls crypto
   and token logic. We added two axes: adversarial **correctness gates** (the insecure
   shortcut must fail) and a **bespoke-decision burden** count. Now "fast but insecure"
   loses, which is the real-world ranking.
2. **One real framework gap.** `vike-stripe` didn't export an app-facing read API, so the
   app hand-rolled the paid gate. Fixed (entitlement seam, [#366]). Stripe flipped from
   "Vike slower" to "Vike faster + 0 burden".

After both fixes: even on minutes, ahead on safety. The `tags` task is in the set on
purpose as a no-edge anchor (plain CRUD, 0 burden both) so the win is honest, not
cherry-picked.

## What this does and does not show

- **Does:** on every integration task, composition removes the security decisions an agent
  would otherwise make by hand. That is the gap.
- **Does, now on push:** even for an *expert* agent, the natural Next implementation fails
  the gate. The unsubscribe payload carries only `{ endpoint }` and `endpoint` is unique,
  so `DELETE WHERE endpoint = ?` is the idiomatic write (not a strawman) — and an IDOR:
  any signed-in user can unsubscribe another by endpoint. Scoping it to the owner is a
  decision the single-user happy path never forces. `vike-push` is owner-scoped by
  construction, so it passes for free. On the other gated tasks (auth, stripe) the expert
  agent still hand-rolls the secure version, so both sides pass and the edge shows up as
  *burden*; push is the one where the shortcut is both natural and wrong.
- **Does not (yet):** a weaker-agent run, where the auth/stripe shortcuts should fail their
  gates too (not just cost burden). Expected to widen the gap further.

## Next

- **vike-teams** task: a hand-rolled query leaks across tenants (BOLA), same shape as the
  push IDOR but on the read path.
- **Weaker-agent axis:** re-run the gated tasks with a weaker model and show the
  hand-rolled auth/stripe sides failing their gates outright, not just carrying burden.

This is also the measurable core of the "safe mode" idea: a fixed, composed extension set
is *why* an agent can't easily ship something insecure.

[#366]: https://github.com/suleimansh/vike-data/pull/366
