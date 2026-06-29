# Task 005: ask a question about a note

The **ai** task. Add a second AI-backed feature next to summarize: answer a free-text question
about a note. On the Vike side `vike-ai`'s `generate()` is already the seam, so the agent adds
one call; on the Next.js side the agent wires a provider call by hand.

Like summarize, the baseline answers through the **deterministic stub provider** (no network,
no key), so the gate is reproducible. The benchmark measures the effort to wire a new AI call,
not model quality, so the acceptance check stays behaviour-level and does not pin answer text.

## Agent prompt (verbatim, given on both apps)

> Add the ability to ask a free-text question about a note and get an answer back, generated
> through the app's AI layer (the same layer summarize uses). It must work for the signed-in
> user, default to the existing deterministic stub provider (no network, no key) so it is
> reproducible, and behave consistently (the same note + question gives the same answer). Keep
> the existing HTTP contract working and extend it exactly as described in the acceptance
> criteria.

## Required contract changes (additive)

- `POST /api/notes/:id/ask` with `{ question: string }` → `200 { answer: string }` where
  `answer` is a non-empty string produced through the app's AI layer.
- `404` when the note does not exist; `401` when unauthenticated.
- Deterministic: the same note id + question returns the same answer (the stub provider is
  pure), so the gate never flakes.

## Acceptance criteria (checked by `tasks/task-005-ai/accept.mjs`)

1. Log in as the seeded user.
2. Create a note.
3. `POST /api/notes/<id>/ask { question }` returns `200` with a non-empty string `answer`.
4. Asking the **same** note + question again returns the same `answer` (deterministic).
5. `POST /api/notes/999999/ask { question }` (absent note) returns `404`.
6. The same request without a session cookie returns `401`.

The script exits `0` only when all checks pass.

## Guardrails

- Hard timeout: 30 minutes wall clock.
- Max interventions before DNF: 5.
- Answer **quality** is a human spot-check, not part of the automated gate (the deterministic
  stub is not a real model); the gate confirms the feature is wired, gated, and reproducible.
