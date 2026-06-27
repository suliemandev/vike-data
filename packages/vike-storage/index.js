// vike-storage - file storage / uploads (server side).
//
// Stateful like vike-push: a file's BYTES live behind a swappable storage port, and a
// METADATA row in `uploads` records what the file is and who owns it. The producer stores
// a file and gets back a stable key + a URL:
//
//   producer:  import { storeUpload } from 'vike-storage'
//              const { key, url } = await storeUpload(user.id, { filename, mime, bytes })
//   app:       import { setStorageProvider } from 'vike-storage'; setStorageProvider(s3(...))
//
// Optional-runtime, like vike-mail/vike-push: with no provider registered, a built-in
// in-memory store keeps the bytes for the dev run (cached on globalThis so they survive
// across requests) and serves them back through the GET /uploads/:key endpoint, so the seam
// is provable with zero infra. A real provider (S3 / R2 / disk) is registered by the app and
// is the swappable piece; its url(key) can return a direct or presigned URL instead.
//
// This module is SERVER-ONLY (it needs the universal-orm adapter + node:crypto). The
// upload control (vike-storage/react, /vue, next PR) imports NONE of it; it only POSTs to
// /uploads. Keep it that way so the client build stays clean.
import { randomUUID } from 'node:crypto'
import { getAdapter } from '@universal-orm/core'
import { createPort, resolveOwnerColumn } from '@vike-data/kit'

const TABLE = 'uploads'

// The column an upload row is OWNED by (#250). Default `user_id`; an app that binds storage to an
// organization (storageOwner in +config.js) sets VIKE_STORAGE_OWNER_COLUMN to the matching column
// (e.g. `organization_id`) so the runtime write/scope matches the build-time FK. Read per call so
// the knob is honoured; blank falls back to the default.
function ownerColumn() {
  return resolveOwnerColumn(process.env.VIKE_STORAGE_OWNER_COLUMN)
}

// A storage key is always a UUID we minted (see `randomUUID` in storeUpload); nothing else is
// a key we would ever issue. Validating the key before it reaches a provider stops a path
// traversal payload (e.g. `..%2f..%2fetc%2fpasswd`, which survives `new URL().pathname`) from
// reaching a naive disk/S3 provider doing `join(root, key)`. Providers MUST still reject keys
// containing path separators or `..` as defense in depth - this is the framework's half.
const STORAGE_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when `key` is a well-formed storage key (a UUID), i.e. one this package could have issued. */
export function isStorageKey(key) {
  return typeof key === 'string' && STORAGE_KEY_RE.test(key)
}

// Cap on a single upload's size. The bytes are buffered to validate + hand to the provider, so
// without a cap an authenticated client could POST a multi-GB body and exhaust server memory
// (concurrent uploads amplify it). Default 10 MiB; override with setMaxUploadBytes() or the
// VIKE_STORAGE_MAX_UPLOAD_BYTES env var. A hard streaming cap against a LYING Content-Length
// belongs at the reverse proxy (its body-size limit), the same edge-vs-app split as throttling.
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const envMax = Number(process.env.VIKE_STORAGE_MAX_UPLOAD_BYTES)
let maxUploadBytes = Number.isFinite(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_UPLOAD_BYTES

/** Set the max bytes a single upload may be (the endpoint rejects larger with 413). */
export function setMaxUploadBytes(n) {
  if (!Number.isFinite(n) || n <= 0) throw new Error('setMaxUploadBytes: expected a positive number of bytes')
  maxUploadBytes = n
}

/** The current max upload size in bytes. */
export function getMaxUploadBytes() {
  return maxUploadBytes
}

// The built-in dev provider: an in-memory blob store cached on globalThis, so uploads
// persist across requests within a single dev run (a fresh Map per request would lose every
// byte). `url(key)` points back at our own GET /uploads/:key route, so a stored file is
// fetchable with no static-dir wiring; a real provider returns its own URL.
const STORE_KEY = Symbol.for('vike-storage.memory-store')
function memoryStore() {
  if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = new Map()
  return globalThis[STORE_KEY]
}
function defaultProvider() {
  return {
    async put(key, bytes, meta) {
      memoryStore().set(key, { bytes, meta })
    },
    async get(key) {
      return memoryStore().get(key) ?? null
    },
    async delete(key) {
      memoryStore().delete(key)
    },
    url(key) {
      return `/uploads/${key}`
    },
  }
}

// The storage provider registry (the set/get/clear port), over @vike-data/kit. A provider
// is `{ put(key, bytes, meta), get(key) -> { bytes, meta } | null, delete(key), url(key) }`.
const providerPort = createPort({
  name: 'vike-storage.provider',
  validate: (p) => {
    for (const m of ['put', 'get', 'delete', 'url']) {
      if (!p || typeof p[m] !== 'function') {
        throw new Error(`setStorageProvider: expected a provider with put/get/delete/url methods (missing ${m})`)
      }
    }
  },
  default: defaultProvider,
})

/** Register the app's storage provider (S3 / R2 / disk). */
export function setStorageProvider(provider) {
  providerPort.set(provider)
}

/** The registered provider, or the built-in in-memory default. */
export function getStorageProvider() {
  return providerPort.get()
}

/** Clear the registered provider (tests). */
export function clearStorageProvider() {
  providerPort.clear()
}

function requireAdapter() {
  const adapter = getAdapter()
  if (!adapter) {
    throw new Error('vike-storage: no universal-orm adapter registered (call setAdapter() first)')
  }
  return adapter
}

/**
 * Store a file owned by `ownerId`: write the bytes through the provider under a fresh
 * unguessable key, then record a metadata row in `uploads`. The owner is the signed-in user by
 * default; with the #250 owner binding it is whatever the app owns uploads by (e.g. an
 * organization id), recorded under the configured owner column. `file` is
 * `{ filename, mime, bytes }`, bytes a Uint8Array/Buffer. Returns
 * `{ id, key, url, filename, mime, size }` - the row id, the provider key, and a URL to fetch it.
 */
export async function storeUpload(ownerId, file) {
  const adapter = requireAdapter()
  const provider = getStorageProvider()
  const bytes = file.bytes ?? new Uint8Array()
  const size = bytes.byteLength ?? bytes.length ?? 0
  const filename = file.filename ?? null
  const mime = file.mime || 'application/octet-stream'
  const key = randomUUID()
  await provider.put(key, bytes, { filename, mime, size })
  const ts = new Date().toISOString()
  const row = {
    id: randomUUID(),
    [ownerColumn()]: ownerId,
    storage_key: key,
    filename,
    mime,
    size,
    created_at: ts,
    updated_at: ts,
  }
  await adapter.insert(TABLE, row)
  return { id: row.id, key, url: provider.url(key), filename, mime, size }
}

/**
 * Read a stored object by its key for the serving endpoint: `{ bytes, meta }` or null. The
 * key is an unguessable uuid (capability-URL semantics) - per-object access control / private
 * buckets are a follow-up.
 */
export async function readUpload(key) {
  // Reject anything that is not a key we could have issued before it reaches the provider,
  // so a traversal payload can never be turned into a filesystem path by a disk provider.
  if (!isStorageKey(key)) return null
  return getStorageProvider().get(key)
}

/**
 * Delete one of an owner's uploads by row id. Scoped to `ownerId` on the configured owner column
 * so a caller can only ever delete a file its owner owns, never another owner's row by guessing
 * its id (the #141 row-scope lesson). With the #250 owner binding the scope is the org, so any
 * member resolving to that org can delete the org's file; without it, it is the single user, as
 * today. Removes the bytes through the provider and the metadata row. Returns the number of rows
 * deleted (0 when the owner has no such upload).
 */
export async function deleteUpload(ownerId, id) {
  const adapter = requireAdapter()
  const col = ownerColumn()
  const row = (await adapter.find(TABLE, { id, [col]: ownerId }))[0]
  if (!row) return 0
  await getStorageProvider().delete(row.storage_key)
  return adapter.delete(TABLE, { id, [col]: ownerId })
}

/** The URL to fetch an object by its storage key (provider-defined). */
export function urlFor(key) {
  return getStorageProvider().url(key)
}
