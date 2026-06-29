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
| `--reset` | off | `git checkout` + `git clean` the app dir to its committed baseline first |
| `--baseurl` | per framework | override the app URL (vike `:3100`, next `:4311`) |
| `--timeout` | `1800` | seconds before recording a DNF |
| `--poll` | `10` | seconds between accept attempts |
| `--interventions` | `0` | human-tallied intervention count |
| `--minutes` | wall clock | real AI minutes (agent execution time), if measured separately |
| `--status` | auto | force `pass`/`dnf` instead of the polled result |

## Metric note

The headline metric is **real AI minutes** (agent execution time), which a generic script
cannot observe. Pass `--minutes` with the measured figure; otherwise the runner records wall
clock from start to accept-pass, which is an upper bound (it includes human/idle time).

## report.json

`report.json` (git-ignored; the Phase 4 aggregator commits a curated baseline) is an array of:

```json
{ "framework": "vike", "task": "task-002-magic-link", "minutes": 4.2, "interventions": 0, "status": "pass", "at": "2026-06-30T..." }
```

Run the same task on both `--framework vike` and `--framework next` to get the comparable pair.
