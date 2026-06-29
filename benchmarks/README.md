# Vike-family AI benchmark: the `vike-*` extension stack vs Next.js

Tracking epic: [#330](https://github.com/suleimansh/vike-data/issues/330). This is the harness for measuring how an AI coding agent performs building the same app on the **Vike `vike-*` extension family** versus an **idiomatic Next.js** stack, on two metrics:

1. **Time-to-task** - real AI minutes (agent execution time) from task start to the acceptance script passing. Not wall clock spent awaiting a human prompt.
2. **Human interventions** - count of times a human had to step in (see the rubric below).

Same agent, same model on both sides, so the number measures the **framework**, not the agent. This is **not** the self-healing loop; it measures an AI agent building and changing apps.

The thesis is **composition**: on the Vike side the assistant snaps in extensions designed to compose (one data layer, auth owns `users`, the toolbar self-wires); on Next.js it integrates five unrelated libraries (Auth.js, Prisma, Resend, Stripe SDK) by hand. The bet is composition means fewer steps and fewer interventions.

> Re-homed from [gemstack-land/gemstack#75](https://github.com/gemstack-land/gemstack/issues/75) (Phase 0). The extensions it measures live in this repo, so the benchmark lives here too.

## Layout

```
benchmarks/
  README.md            <- you are here
  spec/
    product.md            <- the product surface both apps implement (shared HTTP contract)
    task-set.md           <- the task set plan (one task per extension) + grading notes
    task-001-tags.md      <- data task (the no-edge guard)
    task-002-magic-link.md<- auth task (passwordless login)
    task-003-notifications.md <- notifications task (email on note create)
    task-005-ai.md        <- ai task (ask a question about a note)
  tasks/
    task-001-tags/
      accept.mjs          <- contract-level acceptance script (BASE_URL env, exit 0 = pass)
    task-002-magic-link/
      accept.mjs
    task-003-notifications/
      accept.mjs
    task-005-ai/
      accept.mjs
examples/
  bench-app-next/       <- idiomatic Next.js baseline (vanilla)
  bench-app-vike/       <- Vike + React baseline, composed from the vike-* extensions
```

Both apps implement the **same HTTP contract** (`spec/product.md`), so a single acceptance script runs against either by pointing `BASE_URL` at the running server.

## Phases (tracked as children of [#330](https://github.com/suleimansh/vike-data/issues/330))

- **Phase 0** - method proof. One task, both apps, manual stopwatch + manual intervention tally. **Done on gemstack** ([#75](https://github.com/gemstack-land/gemstack/issues/75)); a plain CRUD task (add tags) did **not** differentiate, which is why the task set must lean on the extensions.
- **Phase 1** - app pair: rebuild the Vike side on the `vike-*` extension family + an idiomatic Next.js app, sharing one contract. **Done** ([#341](https://github.com/suleimansh/vike-data/issues/341)).
- **Phase 2** - task set + accept scripts, one per extension (auth / data / notifications / stripe / ai). See `spec/task-set.md`. **In progress** ([#342](https://github.com/suleimansh/vike-data/issues/342)): task-001 data (guard), 002 auth, 003 notifications, 005 ai shipped; 004 stripe pending a grading decision.
- **Phase 3** - semi-automated runner: checkout -> launch agent -> poll accept -> emit `report.json`.
- **Phase 4** - aggregator + first committed baseline.

## Running a task by hand

For each app (`bench-app-next`, `bench-app-vike`):

1. Reset the app to its starting commit (clean baseline).
2. Start the dev server, note the URL.
3. Start the clock. Give the agent the task prompt from `spec/task-001-tags.md`.
4. Let the agent work. Tally every **human intervention** (rubric below).
5. After each agent step, run the acceptance script: `BASE_URL=<url> node benchmarks/tasks/task-001-tags/accept.mjs`. Exit 0 means done; stop the clock.
6. Record minutes, intervention count, and status (pass / DNF) in a run log.

Stop at acceptance pass, or at the hard timeout / max-intervention cap (record as DNF).

## Intervention rubric

Counts as **one human intervention**:

- a manual code correction by a human
- unblocking a stuck agent with a hint
- a clarification the agent had to ask before it could proceed
- an approval gate that required a human
- a manual retry / rerun a human had to trigger

Does **not** count (this is the point of the composition layer):

- the agent's own internal retries, planning, and tool dispatch
- skill / MCP tool calls the agent makes autonomously

## Fairness rules

- Same agent, same model, same harness on both sides.
- Both apps start from a clean, functionally-equivalent baseline implementing the contract.
- The acceptance gate is objective (the script's exit code); no human judgement.
- The Next.js side uses its **real** ecosystem (Auth.js, Prisma, Resend, Stripe SDK), not a strawman. Include at least one task where the extension layer gives **no** edge (anti-cherry-pick guard).
- Guide the agent like a regular engineer on both sides: the Vike side may ship a skill so the agent uses the extensions idiomatically; the Next.js side gets its real ecosystem in return.
