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
import { createPort } from '@vike-data/kit'

const TABLE = 'uploads'

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
 * Store a file for a user: write the bytes through the provider under a fresh unguessable
 * key, then record a metadata row in `uploads`. `file` is `{ filename, mime, bytes }`, bytes
 * a Uint8Array/Buffer. Returns `{ id, key, url, filename, mime, size }` - the row id, the
 * provider key, and a URL to fetch it.
 */
export async function storeUpload(userId, file) {
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
    user_id: userId,
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
  return getStorageProvider().get(key)
}

/**
 * Delete one of a user's uploads by row id. Scoped to `userId` so a caller can only ever
 * delete its OWN file, never another user's row by guessing its id (the #141 row-scope
 * lesson). Removes the bytes through the provider and the metadata row. Returns the number of
 * rows deleted (0 when the user has no such upload).
 */
export async function deleteUpload(userId, id) {
  const adapter = requireAdapter()
  const row = (await adapter.find(TABLE, { id, user_id: userId }))[0]
  if (!row) return 0
  await getStorageProvider().delete(row.storage_key)
  return adapter.delete(TABLE, { id, user_id: userId })
}

/** The URL to fetch an object by its storage key (provider-defined). */
export function urlFor(key) {
  return getStorageProvider().url(key)
}
