// The HTTP contract (shared with bench-app-next), implemented over the extensions:
// vike-auth for identity + sessions, the universal ORM for notes, vike-ai for summarize.
// The contract is unchanged, so the same acceptance script grades this app and the Next.js
// twin; only the internals now compose the vike-* family instead of hand-rolling.
import { randomUUID } from 'node:crypto'
import type { Express, Request, Response, NextFunction } from 'express'
import { SESSION_COOKIE, SESSION_TTL_MS } from 'vike-auth'
import { auth, db, nextNoteId, SEED_EMAIL, SEED_PASSWORD } from './bootstrap.js'
import { summarize } from './ai.js'

/** Map a stored row to the contract's `Note` shape (created_at -> createdAt). */
function toNote(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    title: row.title as string,
    body: row.body as string,
    summary: (row.summary ?? null) as string | null,
    createdAt: row.created_at as string,
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

/** Resolve the signed-in user from the session cookie, via vike-auth. */
async function currentUser(req: Request): Promise<{ id: string } | null> {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return null
  const resolved = await auth.authenticate(token)
  return resolved ? resolved.user : null
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  currentUser(req)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'unauthenticated' })
        return
      }
      next()
    })
    .catch(next)
}

/** Register the HTTP contract on an Express app. Returns the app for chaining. */
export function registerApi(app: Express): Express {
  // POST /api/login — verify the seed credentials, then mint a real vike-auth session.
  // vike-auth is passwordless (magic link), so the baseline checks the benchmark-fixed
  // password and opens a session through vike-auth's store; switching the app to magic-link
  // is a later benchmark task, not a baseline concern.
  app.post('/api/login', (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string }
    void (async () => {
      if (email !== SEED_EMAIL || password !== SEED_PASSWORD) {
        res.status(401).json({ error: 'invalid credentials' })
        return
      }
      const user = await auth.store.findUserByEmail(SEED_EMAIL)
      if (!user) {
        res.status(401).json({ error: 'invalid credentials' })
        return
      }
      const token = randomUUID()
      await auth.store.createSession({
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' })
      res.status(200).json({ ok: true })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  // POST /api/logout — destroy the session row (real server-side logout).
  app.post('/api/logout', (req: Request, res: Response) => {
    const token = parseCookies(req)[SESSION_COOKIE]
    void (async () => {
      if (token) await auth.destroySession(token)
      res.clearCookie(SESSION_COOKIE, { path: '/' })
      res.status(200).json({ ok: true })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  // GET /api/notes
  app.get('/api/notes', requireAuth, (_req: Request, res: Response) => {
    void (async () => {
      const rows = await db().notes.find({}, { orderBy: { column: 'id', dir: 'desc' } })
      res.status(200).json({ notes: rows.map(toNote) })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  // POST /api/notes
  app.post('/api/notes', requireAuth, (req: Request, res: Response) => {
    const { title, body } = (req.body ?? {}) as { title?: string; body?: string }
    if (typeof title !== 'string' || typeof body !== 'string') {
      res.status(400).json({ error: 'title and body are required' })
      return
    }
    void (async () => {
      const note = await db().notes.insert({
        id: nextNoteId(),
        title,
        body,
        summary: null,
        created_at: new Date().toISOString(),
      })
      res.status(201).json({ note: toNote(note) })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  // GET /api/notes/:id
  app.get('/api/notes/:id', requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const note = await db().notes.findOne({ id: Number(req.params.id) })
      if (!note) {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.status(200).json({ note: toNote(note) })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  // DELETE /api/notes/:id
  app.delete('/api/notes/:id', requireAuth, (req: Request, res: Response) => {
    void (async () => {
      await db().notes.delete({ id: Number(req.params.id) })
      res.status(200).json({ ok: true })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  // POST /api/notes/:id/summarize
  app.post('/api/notes/:id/summarize', requireAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id)
    void (async () => {
      const note = await db().notes.findOne({ id })
      if (!note) {
        res.status(404).json({ error: 'not found' })
        return
      }
      const summary = await summarize(note.body as string)
      const updated = await db().notes.update({ id }, { summary })
      res.status(200).json({ note: toNote(updated[0] ?? { ...note, summary }) })
    })().catch((err) => res.status(500).json({ error: String(err) }))
  })

  return app
}
