// The framework-agnostic client helpers, covered by mocking fetch (the browser File picker +
// the per-framework controls are verified in the app). Asserts the request shape and the
// error mapping, the parts that are pure logic.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { uploadFile, deleteUpload } from '../client.js'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('uploadFile POSTs the file as multipart to /uploads and returns the record', async () => {
  let seen
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts }
    return new Response(JSON.stringify({ ok: true, id: 'r1', key: 'k1', url: '/uploads/k1', filename: 'a.txt' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const file = new File([new Uint8Array([1, 2])], 'a.txt', { type: 'text/plain' })
  const out = await uploadFile(file)

  assert.equal(seen.url, '/uploads')
  assert.equal(seen.opts.method, 'POST')
  assert.equal(seen.opts.credentials, 'same-origin')
  assert.ok(seen.opts.body instanceof FormData)
  assert.equal(seen.opts.body.get('file').name, 'a.txt')
  assert.equal(out.url, '/uploads/k1')
})

test('uploadFile maps a 401 to a clear sign-in error', async () => {
  globalThis.fetch = async () => new Response('', { status: 401 })
  await assert.rejects(() => uploadFile(new File(['x'], 'x')), /signed in/)
})

test('uploadFile throws without a file', async () => {
  await assert.rejects(() => uploadFile(null), /a file is required/)
})

test('deleteUpload sends a scoped DELETE to /uploads/:id', async () => {
  let seen
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts }
    return new Response('', { status: 200 })
  }
  const ok = await deleteUpload('row-123')
  assert.equal(seen.url, '/uploads/row-123')
  assert.equal(seen.opts.method, 'DELETE')
  assert.equal(ok, true)
})
