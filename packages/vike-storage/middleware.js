// The vike-storage server endpoint: a universal middleware (server-agnostic) owning the
// upload routes.
//
//   POST   /uploads        multipart/form-data, field `file`  -> stores it, returns { key, url, ... }
//   GET    /uploads/:key   serves the stored bytes (capability URL; the key is an unguessable uuid)
//   DELETE /uploads/:id    removes the calling user's own upload by row id
//
// POST and DELETE are bound to the signed-in user (resolved from the session cookie via
// vike-auth's server seam), so a client can only upload as itself and delete only its own
// files. GET is unauthenticated by design: the key is unguessable, the capability-URL pattern
// most blob stores use - per-object ACLs / private buckets are a follow-up. Contributed through
// the cumulative `middleware` config from +config.js.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { resolveSessionUser } from 'vike-auth/server'
import { storeUpload, readUpload, deleteUpload } from './index.js'

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

// Stored bytes carry a browser-supplied mime (the multipart `file.type`), so the served
// Content-Type is attacker-controlled. Serving `text/html` (or a sniffable payload) from the
// app's own origin would execute script in that origin. We only ever render a small allowlist
// of inert image types inline; everything else is forced to `application/octet-stream` and
// downloaded as an attachment. SVG is deliberately excluded - it can carry script. Every
// response also gets `X-Content-Type-Options: nosniff` so the browser can't sniff past us.
const INLINE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])

function serveHeaders(meta, byteLength) {
  const mime = (meta?.mime || '').toLowerCase().split(';', 1)[0].trim()
  const inline = INLINE_MIMES.has(mime)
  return {
    'Content-Type': inline ? mime : 'application/octet-stream',
    'Content-Length': String(meta?.size ?? byteLength ?? 0),
    'Content-Disposition': inline ? 'inline' : 'attachment',
    'X-Content-Type-Options': 'nosniff',
  }
}

export function createStorageMiddleware() {
  // Vike dedupes identical `middleware` contributions by extension identity
  // (vikejs/vike#3354), so this runs once per request even when several extensions
  // self-install vike-storage. No per-request idempotency guard is needed.
  async function storageMiddleware(request) {
    const url = new URL(request.url)
    // Match /uploads (the collection) and /uploads/:rest (an item). `rest` is '' for the
    // collection, the key/id otherwise; null means the path isn't ours (fall through to Vike).
    const rest =
      url.pathname === '/uploads' ? '' : url.pathname.startsWith('/uploads/') ? url.pathname.slice('/uploads/'.length) : null
    if (rest === null) return

    // POST /uploads - upload a file as the signed-in user.
    if (request.method === 'POST' && rest === '') {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      let form
      try {
        form = await request.formData()
      } catch {
        return json(400, { error: 'invalid-multipart' })
      }
      const file = form.get('file')
      if (!file || typeof file.arrayBuffer !== 'function') return json(400, { error: 'no-file' })
      const bytes = new Uint8Array(await file.arrayBuffer())
      const saved = await storeUpload(user.id, { filename: file.name, mime: file.type, bytes })
      return json(200, { ok: true, ...saved })
    }

    // GET /uploads/:key - serve the bytes (capability URL, no auth; key is unguessable).
    if (request.method === 'GET' && rest) {
      const obj = await readUpload(rest)
      if (!obj) return json(404, { error: 'not-found' })
      return new Response(obj.bytes, {
        status: 200,
        headers: serveHeaders(obj.meta, obj.bytes.byteLength),
      })
    }

    // DELETE /uploads/:id - remove the caller's own upload. Owner-scoped, idempotent (always
    // 200, no existence oracle), so guessing another user's id deletes nothing.
    if (request.method === 'DELETE' && rest) {
      const user = await resolveSessionUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      await deleteUpload(user.id, rest)
      return json(200, { ok: true })
    }

    return json(404, { error: 'unknown-storage-route' })
  }

  return enhance(storageMiddleware, { name: 'vike-storage', order: MiddlewareOrder.AUTHENTICATION })
}

export default createStorageMiddleware()
