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
import { getAdapter } from '@universal-orm/core'
import { jsonResponse as json, resolveOwnerId as resolveOwnerIdShared } from '@vike-data/kit'
import { resolveGuardedUser, resolveGuardSubjectTable } from 'vike-auth/server'
import { storeUpload, readUpload, deleteUpload, getMaxUploadBytes } from './index.js'

// Resolve the signed-in USER for an upload from the guard the app bound storage to
// (VIKE_STORAGE_GUARD, #278 / #207 P3), via vike-auth's shared by-name seam. Set to a named guard,
// the user is read from THAT guard's session cookie + subject (e.g. `admins`); unset / 'default' /
// an unregistered name falls back to the default subject — byte-for-byte today's behaviour. This is
// the AUTH step; the OWNER id is derived from it below (they differ only under the #250 owner
// binding).
const resolveUploadUser = (request) => resolveGuardedUser(request, process.env.VIKE_STORAGE_GUARD)

// The subject table the signed-in user lives in (the guard's subject, or the default `users`).
// Used to load the full subject row when the owner id lives on a column other than `.id`.
const userSubjectTable = () => resolveGuardSubjectTable(process.env.VIKE_STORAGE_GUARD)

// Resolve the OWNER id for a request from the signed-in user (#250), via the shared kit contract.
// By default the owner IS the user (owner id = `user.id`) and storage stays single-owner; when the
// app binds uploads to a different owner (VIKE_STORAGE_OWNER_FROM, e.g. `current_organization_id`)
// kit loads the subject row and reads that field, returning null when the user has no such owner so
// the caller answers 403. Matches the build-time `storageOwner` column the app set.
const resolveOwnerId = (user) =>
  resolveOwnerIdShared(user, {
    from: process.env.VIKE_STORAGE_OWNER_FROM,
    subjectTable: userSubjectTable(),
    adapter: getAdapter(),
  })

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

    // POST /uploads - upload a file owned by the signed-in user (or their bound owner, e.g. org).
    if (request.method === 'POST' && rest === '') {
      const user = await resolveUploadUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const ownerId = await resolveOwnerId(user)
      if (!ownerId) return json(403, { error: 'no-owner' })
      // Reject an over-size upload. Content-Length is the cheap pre-check that rejects an
      // honest multi-GB body BEFORE it is buffered into memory; we re-check the parsed file
      // size below for a request that sent no/an understated Content-Length.
      const max = getMaxUploadBytes()
      const declared = Number(request.headers.get('content-length'))
      if (Number.isFinite(declared) && declared > max) return json(413, { error: 'upload-too-large', max })
      let form
      try {
        form = await request.formData()
      } catch {
        return json(400, { error: 'invalid-multipart' })
      }
      const file = form.get('file')
      if (!file || typeof file.arrayBuffer !== 'function') return json(400, { error: 'no-file' })
      if (typeof file.size === 'number' && file.size > max) return json(413, { error: 'upload-too-large', max })
      const bytes = new Uint8Array(await file.arrayBuffer())
      const saved = await storeUpload(ownerId, { filename: file.name, mime: file.type, bytes })
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

    // DELETE /uploads/:id - remove an upload the caller's owner owns. Owner-scoped, idempotent
    // (always 200, no existence oracle), so guessing another owner's id deletes nothing. Under the
    // #250 org binding the scope is the org, so any member of the owning org can delete its file.
    if (request.method === 'DELETE' && rest) {
      const user = await resolveUploadUser(request)
      if (!user) return json(401, { error: 'not-signed-in' })
      const ownerId = await resolveOwnerId(user)
      if (!ownerId) return json(403, { error: 'no-owner' })
      await deleteUpload(ownerId, rest)
      return json(200, { ok: true })
    }

    return json(404, { error: 'unknown-storage-route' })
  }

  return enhance(storageMiddleware, { name: 'vike-storage', order: MiddlewareOrder.AUTHENTICATION })
}

export default createStorageMiddleware()
