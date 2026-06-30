# Results: `vike-*` extensions vs Next.js, built by an AI agent

The same Notes app, built by the same AI agent (same model) on two stacks: the Vike
`vike-*` extension family, and an idiomatic Next.js stack using its real ecosystem
(Auth.js, Prisma, Resend, Stripe SDK). Five tasks, one per extension. Full method in
[`README.md`](./README.md); raw numbers in [`runner/baseline.json`](./runner/baseline.json).

## The takeaway

**Speed is about even. Safety is not.**

Building the same app, the agent makes **~0 bespoke security decisions** on the Vike
stack vs **~11** on Next. On Vike it reuses extension seams (signed webhooks, single-use
+ expiry login tokens, no account-existence oracle); on Next it hand-writes each one.
Every hand-written one is a place to get security wrong.

## The numbers (5 tasks)

| Task | Extension | vike | next |
|---|---|---|---|
| auth (magic link) | vike-auth | 1/1 gate · 3.2m · **0** burden | 1/1 gate · 3.5m · **4** burden |
| notifications | vike-mail | 3.0m · **0** burden | 2.1m · **2** burden |
| stripe (paid gate) | vike-stripe | 1/1 gate · 2.0m · **0** burden | 1/1 gate · 2.6m · **4** burden |
| ai (ask a note) | vike-ai | 1.6m · **0** burden | 1.8m · **1** burden |
| data (tags) | universal-orm | 2.6m · **0** burden | 2.7m · **0** burden |
| **Total** | | **12.4m · 0 burden** | **12.7m · 11 burden** |

0 human interventions on either side, every task. `gate` = a v2 adversarial correctness
check (e.g. an unsigned Stripe webhook must be rejected); `burden` = bespoke
security/correctness decisions the agent made unaided, a latent-bug proxy.

Read it as: **minutes tie, the agent ships ~11 security-sensitive bits by hand on Next
and ~0 on Vike.**

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
- **Does not (yet):** this was an *expert* agent, the worst case for the thesis. It
  hand-rolls the Next security correctly, so today both sides pass the gates. The
  composition edge should be *larger* for a weaker agent, where the hand-rolled side
  actually fails the gate. That run is the next one.

## Next

- **vike-push** and **vike-teams** tasks, where the gate genuinely bites: a hand-rolled
  unsubscribe leaks across users (IDOR), a hand-rolled query leaks across tenants (BOLA).
- **Weaker-agent axis:** re-run a gated task with a weaker model and show the hand-rolled
  side failing the gate outright.

This is also the measurable core of the "safe mode" idea: a fixed, composed extension set
is *why* an agent can't easily ship something insecure.

[#366]: https://github.com/suleimansh/vike-data/pull/366
