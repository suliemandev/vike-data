// vike-storage server core: the storage port + ops over universal-orm (memory adapter), and
// the upload endpoint (multipart upload bound to the signed-in user, capability-URL serving,
// owner-scoped delete with an IDOR guard). The per-framework upload control is browser-bound
// and lands with its own tests next, like vike-push's client split.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAdapter, clearAdapter } from '@universal-orm/core'
import { createMemoryAdapter } from '@universal-orm/memory'
import { createAuth, createStore, SESSION_COOKIE } from 'vike-auth'
import { storeUpload, readUpload, deleteUpload, setStorageProvider, clearStorageProvider, urlFor } from '../index.js'
import { createStorageMiddleware } from '../middleware.js'

function setup() {
  clearAdapter()
  clearStorageProvider()
  // Reset the default in-memory blob store (shared on globalThis across requests/tests).
  globalThis[Symbol.for('vike-storage.memory-store')]?.clear()
  const adapter = createMemoryAdapter()
  setAdapter(adapter)
  return adapter
}

async function openSessionCookie(email) {
  const a = createAuth({ store: createStore() })
  const { token } = await a.requestMagicLink(email)
  const { session } = await a.redeemMagicLink(token)
  return `${SESSION_COOKIE}=${session.token}`
}

const fileOf = (name, type, ...bytes) => new File([new Uint8Array(bytes)], name, { type })

test('storeUpload writes the bytes through the provider and a metadata row', async () => {
  const adapter = setup()
  const saved = await storeUpload('u-1', { filename: 'hello.txt', mime: 'text/plain', bytes: new Uint8Array([104, 105]) })
  assert.ok(saved.id && saved.key)
  assert.equal(saved.url, `/uploads/${saved.key}`)
  assert.equal(saved.filename, 'hello.txt')
  assert.equal(saved.mime, 'text/plain')
  assert.equal(saved.size, 2)

  const rows = await adapter.find('uploads', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, 'u-1')
  assert.equal(rows[0].storage_key, saved.key)
  assert.equal(rows[0].size, 2)

  const obj = await readUpload(saved.key)
  assert.deepEqual([...obj.bytes], [104, 105])
  assert.equal(obj.meta.mime, 'text/plain')
})

test('urlFor delegates to the provider (the dev default serves through /uploads/:key)', async () => {
  setup()
  assert.equal(urlFor('abc'), '/uploads/abc')
})

test('a custom provider replaces the default for bytes + url', async () => {
  const adapter = setup()
  const seen = {}
  setStorageProvider({
    async put(key, bytes, meta) {
      seen[key] = { bytes, meta }
    },
    async get(key) {
      return seen[key] ?? null
    },
    async delete(key) {
      delete seen[key]
    },
    url: (key) => `https://cdn.example/${key}`,
  })
  const saved = await storeUpload('u-1', { filename: 'a.bin', mime: 'application/octet-stream', bytes: new Uint8Array([1]) })
  assert.equal(saved.url, `https://cdn.example/${saved.key}`)
  assert.ok(seen[saved.key])
  // metadata row still recorded through universal-orm
  assert.equal((await adapter.find('uploads', {})).length, 1)
})

test('deleteUpload removes the caller\'s own file (bytes + row)', async () => {
  const adapter = setup()
  const saved = await storeUpload('u-1', { filename: 'x', mime: 'text/plain', bytes: new Uint8Array([1, 2, 3]) })
  const n = await deleteUpload('u-1', saved.id)
  assert.equal(n, 1)
  assert.equal((await adapter.find('uploads', {})).length, 0)
  assert.equal(await readUpload(saved.key), null) // bytes gone too
})

test('deleteUpload will not delete another user\'s file (IDOR guard)', async () => {
  const adapter = setup()
  const saved = await storeUpload('u-1', { filename: 'x', mime: 'text/plain', bytes: new Uint8Array([9]) })
  const n = await deleteUpload('u-2', saved.id) // u-2 guesses u-1's id
  assert.equal(n, 0)
  assert.equal((await adapter.find('uploads', {})).length, 1)
  assert.notEqual(await readUpload(saved.key), null) // bytes untouched
})

test('POST /uploads binds the upload to the signed-in user', async () => {
  const adapter = setup()
  const cookie = await openSessionCookie('up@example.com')
  const mw = createStorageMiddleware()

  const fd = new FormData()
  fd.append('file', fileOf('note.txt', 'text/plain', 72, 73)) // "HI"
  const res = await mw(new Request('http://localhost/uploads', { method: 'POST', headers: { cookie }, body: fd }))

  assert.equal(res.status, 200)
  const out = await res.json()
  assert.equal(out.ok, true)
  assert.equal(out.filename, 'note.txt')

  const user = (await adapter.find('users', { email: 'up@example.com' }))[0]
  const rows = await adapter.find('uploads', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, user.id)

  // the returned url serves the bytes back - as a hardened download, not inline text/plain
  const get = await mw(new Request(`http://localhost${out.url}`, { method: 'GET' }))
  assert.equal(get.status, 200)
  assert.equal(get.headers.get('content-type'), 'application/octet-stream')
  assert.equal(get.headers.get('content-disposition'), 'attachment')
  assert.equal(get.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual([...new Uint8Array(await get.arrayBuffer())], [72, 73])
})

test('GET neutralizes an attacker-supplied text/html mime (no same-origin XSS)', async () => {
  const adapter = setup()
  const owner = await openSessionCookie('xss@example.com')
  const user = (await adapter.find('users', { email: 'xss@example.com' }))[0]
  const saved = await storeUpload(user.id, {
    filename: 'evil.html',
    mime: 'text/html',
    bytes: new TextEncoder().encode('<script>alert(1)</script>'),
  })
  const mw = createStorageMiddleware()

  const get = await mw(new Request(`http://localhost/uploads/${saved.key}`, { method: 'GET' }))
  assert.equal(get.status, 200)
  // forced to octet-stream + attachment + nosniff so it downloads instead of executing
  assert.equal(get.headers.get('content-type'), 'application/octet-stream')
  assert.equal(get.headers.get('content-disposition'), 'attachment')
  assert.equal(get.headers.get('x-content-type-options'), 'nosniff')
})

test('GET serves an allowlisted image type inline (with nosniff)', async () => {
  const adapter = setup()
  await openSessionCookie('img@example.com')
  const user = (await adapter.find('users', { email: 'img@example.com' }))[0]
  const saved = await storeUpload(user.id, {
    filename: 'pic.png',
    mime: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
  })
  const mw = createStorageMiddleware()

  const get = await mw(new Request(`http://localhost/uploads/${saved.key}`, { method: 'GET' }))
  assert.equal(get.status, 200)
  assert.equal(get.headers.get('content-type'), 'image/png')
  assert.equal(get.headers.get('content-disposition'), 'inline')
  assert.equal(get.headers.get('x-content-type-options'), 'nosniff')
})

test('GET does not serve an SVG inline (script-capable image type)', async () => {
  const adapter = setup()
  await openSessionCookie('svg@example.com')
  const user = (await adapter.find('users', { email: 'svg@example.com' }))[0]
  const saved = await storeUpload(user.id, {
    filename: 'x.svg',
    mime: 'image/svg+xml',
    bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  })
  const mw = createStorageMiddleware()

  const get = await mw(new Request(`http://localhost/uploads/${saved.key}`, { method: 'GET' }))
  assert.equal(get.status, 200)
  assert.equal(get.headers.get('content-type'), 'application/octet-stream')
  assert.equal(get.headers.get('content-disposition'), 'attachment')
})

test('POST /uploads is 401 without a session', async () => {
  setup()
  const mw = createStorageMiddleware()
  const fd = new FormData()
  fd.append('file', fileOf('x', 'text/plain', 1))
  const res = await mw(new Request('http://localhost/uploads', { method: 'POST', body: fd }))
  assert.equal(res.status, 401)
})

test('POST /uploads is 400 when no file field is present', async () => {
  setup()
  const cookie = await openSessionCookie('nofile@example.com')
  const mw = createStorageMiddleware()
  const res = await mw(new Request('http://localhost/uploads', { method: 'POST', headers: { cookie }, body: new FormData() }))
  assert.equal(res.status, 400)
})

test('GET /uploads/:key is 404 for an unknown key', async () => {
  setup()
  const mw = createStorageMiddleware()
  const res = await mw(new Request('http://localhost/uploads/does-not-exist', { method: 'GET' }))
  assert.equal(res.status, 404)
})

test('DELETE /uploads/:id cannot remove another signed-in user\'s upload', async () => {
  const adapter = setup()
  await openSessionCookie('owner@example.com')
  const attacker = await openSessionCookie('attacker@example.com')
  const owner = (await adapter.find('users', { email: 'owner@example.com' }))[0]
  const saved = await storeUpload(owner.id, { filename: 'secret', mime: 'text/plain', bytes: new Uint8Array([1]) })

  const mw = createStorageMiddleware()
  const res = await mw(new Request(`http://localhost/uploads/${saved.id}`, { method: 'DELETE', headers: { cookie: attacker } }))
  // 200 (idempotent, no oracle), but the owner's row survives.
  assert.equal(res.status, 200)
  const rows = await adapter.find('uploads', {})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, owner.id)

  // the owner can delete it
  const cookieOwner = await openSessionCookie('owner@example.com')
  const ok = await mw(new Request(`http://localhost/uploads/${saved.id}`, { method: 'DELETE', headers: { cookie: cookieOwner } }))
  assert.equal(ok.status, 200)
  assert.equal((await adapter.find('uploads', {})).length, 0)
})

test('a path that is not /uploads falls through (returns undefined)', async () => {
  setup()
  const mw = createStorageMiddleware()
  const res = await mw(new Request('http://localhost/something-else', { method: 'GET' }))
  assert.equal(res, undefined)
})
