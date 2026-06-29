# bench-app-vike

The **Vike** side of the AI benchmark (see `benchmarks/`). A minimal but real
**Vike + React (SSR)** Notes app **composed from the `vike-*` extension family**:

- **vike-auth** owns identity + sessions (the `users` / `sessions` tables, the session
  cookie, real server-side logout).
- the **universal ORM** (`@universal-orm/*` + `@vike-data/vike-schema`) owns the `notes`
  data layer.
- **vike-ai** owns the AI summarize seam.

The app wires these together; it does not reimplement them. That composition is what the
benchmark measures (Phase 1 of [#330](https://github.com/suleimansh/vike-data/issues/330)).

Its twin, `bench-app-next`, implements the **same product and the same HTTP contract**
(`benchmarks/spec/product.md`) by hand-integrating an unrelated stack, so one acceptance
script runs against either by pointing `BASE_URL` at the server.

> Baseline scope: notes have `id`, `title`, `body`, `summary`, `createdAt` only. Tags are a
> later agent task and are intentionally **not** implemented here.

## Run

From the repo root, install once, then start the app:

```bash
pnpm install
cd examples/bench-app-vike
pnpm dev                                   # http://localhost:3100
```

Fixed port **3100** (override with `PORT`). It differs from the Next.js sibling's **4311**
so both can run at once. The server is Express in Vite middleware mode: it serves `/api/*`
directly and hands every other route to Vike for React SSR.

Seed user: `demo@example.com` / `password` (seeded through vike-auth's store on first boot).

## HTTP contract

JSON everywhere. Auth endpoints set/clear a session cookie; protected endpoints require it
and return `401` without it.

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/login` | `{ email, password }` | `200 { ok: true }` + cookie (`401` on bad creds) |
| POST | `/api/logout` | – | `200 { ok: true }` |
| GET | `/api/notes` | – | `200 { notes: Note[] }` (newest first) |
| POST | `/api/notes` | `{ title, body }` | `201 { note: Note }` |
| GET | `/api/notes/:id` | – | `200 { note: Note }` (`404` if absent) |
| DELETE | `/api/notes/:id` | – | `200 { ok: true }` |
| POST | `/api/notes/:id/summarize` | – | `200 { note: Note }` (sets `summary`) |

`Note` = `{ id: number, title: string, body: string, summary: string | null, createdAt: string }`.

## How the extensions compose

- **Auth** — `server/bootstrap.ts` builds vike-auth's headless core (`createAuth({ store:
  createStore() })`). vike-auth is passwordless (magic link); the baseline checks the
  benchmark-fixed password and then mints a real vike-auth session through its store, so
  `/api/login` returns vike-auth's session cookie and `/api/logout` truly revokes it.
  Switching the app to magic-link login is a later benchmark task, not a baseline concern.
- **Data** — `server/schema.ts` defines the `notes` table via the schema DSL; the repository
  (`createRepository`) runs CRUD over the registered adapter. The baseline uses the in-memory
  adapter; pointing it at a real database is one line in `bootstrap.ts`.
- **AI** — `server/ai.ts` calls vike-ai's `generate()`. The provider is registered in
  `bootstrap.ts`: a deterministic stub (first sentence of the body, ≤ 140 chars; no network,
  no key) so the baseline is reproducible. A real provider (vike-ai-gemstack over
  `@gemstack/ai-sdk`) is a one-line swap.

## Layout

```
server/
  index.ts     Express + Vite-middleware dev server (API + Vike SSR catch-all)
  bootstrap.ts register the ORM adapter + AI provider, build the repo, seed the demo user
  schema.ts    the `notes` table (vike-schema)
  api.ts       the HTTP contract over vike-auth + the ORM + vike-ai
  ai.ts        summarize() through vike-ai + the stub's summary function
pages/
  +config.ts        vike-react config
  index/+Page.tsx   notes list (create form, per-note delete + summarize)
  login/+Page.tsx   sign-in
  note/@id/+Page.tsx note detail
  api.ts            client-side fetch wrapper over the contract
```
