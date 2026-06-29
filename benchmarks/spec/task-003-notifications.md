# Task 003: notify the user when a note is created

The **notifications** task. Creating a note should send the user a notification (an email in
production). On the Vike side `vike-notifications` + `vike-mail` self-wire and ship a dev
outbox; on the Next.js side the agent hand-wires a provider (e.g. Resend) plus a dev sink.
Both expose the **same** dev outbox endpoint, so delivery is graded offline with no real email.

## Agent prompt (verbatim, given on both apps)

> When a note is created, send the signed-in user a notification (in production this is an
> email; in development it goes to a dev outbox instead of being sent). Expose the dev outbox
> at `GET /api/dev/outbox` so it can be inspected. Each notification is addressed to the
> user's email and references the note that was created. Keep the existing HTTP contract
> working and extend it exactly as described in the acceptance criteria.

## Required contract changes (additive)

- `POST /api/notes` continues to create the note **and** now also produces one notification to
  the signed-in user's email.
- `GET /api/dev/outbox` → `200 { messages: Message[] }`, newest-last is fine. `Message` =
  `{ to: string, subject: string }` (more fields allowed). This is a **dev / benchmark sink**:
  it captures what would have been emailed; no real mail is sent.
- Notifications are produced **only** on note creation in this task (so the count is
  predictable).

## Acceptance criteria (checked by `tasks/task-003-notifications/accept.mjs`)

1. Log in as the seeded user.
2. Read `GET /api/dev/outbox`; record the message count `before`.
3. Create a note.
4. `GET /api/dev/outbox` now has exactly `before + 1` messages.
5. The new message's `to` is the seeded user's email (`demo@example.com`).
6. Creating a second note yields exactly one more message (`before + 2`).

The script exits `0` only when all checks pass.

## Guardrails

- Hard timeout: 30 minutes wall clock.
- Max interventions before DNF: 5.
- Delivery is graded through the dev outbox; no real email is sent or required.
