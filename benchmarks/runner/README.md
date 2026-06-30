# Benchmark runner

The semi-automated runner for the task set (`../spec/task-set.md`). It automates the
mechanical loop — reset the app to its baseline, boot it, poll the task's `accept.mjs` until it
passes or times out, record a `report.json` entry. The agent itself is human-driven: you run
the AI coding agent against the running app in another terminal. That is the "semi" part.

## Run

```bash
# reset + boot the Vike app, then poll task-002 until accept passes (or 30m timeout)
node benchmarks/runner/run.mjs --framework vike --task task-002-magic-link --start-app --reset

# in another terminal: drive the coding agent on the task prompt against the running app
# (spec/task-002-magic-link.md). When accept.mjs passes, the runner stops the clock.

# record the human-tallied figures (or edit the emitted entry afterwards):
#   --interventions N   interventions per the rubric (default 0)
#   --minutes M         real AI minutes; omit to record wall clock instead
```

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--framework` | (required) | `vike` or `next` |
| `--task` | (required) | a task folder under `../tasks/` (e.g. `task-002-magic-link`) |
| `--start-app` | off | boot the app (and tear it down at the end); else assume it is already running |
| `--reset` | off | restore the app to its committed baseline: `git checkout` + `git clean`, then delete the app's git-ignored runtime state (the Next app's SQLite `data/`) so both sides start each run equally clean |
| `--baseurl` | per framework | override the app URL (vike `:3100`, next `:4311`) |
| `--timeout` | `1800` | seconds before recording a DNF |
| `--poll` | `10` | seconds between accept attempts |
| `--interventions` | `0` | human-tallied intervention count |
| `--burden` | (unset) | bespoke security/correctness decisions made unaided (v2 latent-bug proxy) |
| `--minutes` | wall clock | real AI minutes (agent execution time), if measured separately |
| `--status` | auto | force `pass`/`dnf` instead of the polled result |
| `--skip-gates` | off | don't run the task's v2 correctness gates after accept passes |

## Correctness gates (v2)

After `accept.mjs` passes, the runner runs every `*-gate.mjs` in the task dir (e.g.
`tasks/task-004-stripe/webhook-gate.mjs`) against the still-running app and records each as
pass/fail under `gates` on the report entry. These are the adversarial checks the happy-path
contract can't see — e.g. an unsigned Stripe webhook must be rejected (see `spec/methodology-v2.md`).
A framework that fails a gate **loses on correctness regardless of minutes**; the aggregator
shows `gates passed/total` first in each cell. Pass `--skip-gates` to record only the contract result.

## Metric note

The headline metric is **real AI minutes** (agent execution time), which a generic script
cannot observe. Pass `--minutes` with the measured figure; otherwise the runner records wall
clock from start to accept-pass, which is an upper bound (it includes human/idle time).

## report.json

`report.json` (git-ignored; the aggregator promotes a curated `baseline.json`) is an array of:

```json
{ "framework": "vike", "task": "task-004-stripe", "minutes": 4.2, "interventions": 0, "status": "pass", "gates": [{ "name": "webhook", "passed": true }], "at": "2026-06-30T..." }
```

`gates` is present only for tasks that ship a `*-gate.mjs` (omitted otherwise).

Run the same task on both `--framework vike` and `--framework next` to get the comparable pair.

## Aggregator (Phase 4)

`aggregate.mjs` reads the run entries and renders one comparison table: time + interventions,
per task, per framework, side by side, with the vike-vs-next delta (negative favours vike).
Multiple runs of the same `(framework, task)` are averaged.

```bash
# table from baseline.json (or report.json if no baseline yet)
node benchmarks/runner/aggregate.mjs

# machine-readable aggregate
node benchmarks/runner/aggregate.mjs --json

# force report.json, or aggregate an explicit file
node benchmarks/runner/aggregate.mjs --report
node benchmarks/runner/aggregate.mjs --input some-run.json

# end a measurement session: promote report.json -> committed baseline.json
node benchmarks/runner/aggregate.mjs --save-baseline
git add benchmarks/runner/baseline.json && git commit -m "bench: baseline run"
```

Source precedence: `--input` > `--report` > `baseline.json` (if present) > `report.json`.
`baseline.json` is committed (the tracked numbers); `report.json` stays git-ignored (ad-hoc).
