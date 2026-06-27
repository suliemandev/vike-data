import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonResponse, readJsonSafe } from '../index.js'

// The shared middleware helpers the extension endpoints (storage / notifications / push) return
// JSON with, and read a request body with.

test('jsonResponse: status + application/json body', async () => {
  const res = jsonResponse(403, { error: 'no-owner' })
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('Content-Type'), 'application/json')
  assert.deepEqual(await res.json(), { error: 'no-owner' })
})

test('readJsonSafe: parses a JSON body', async () => {
  const req = new Request('http://x/', { method: 'POST', body: JSON.stringify({ endpoint: 'e1' }) })
  assert.deepEqual(await readJsonSafe(req), { endpoint: 'e1' })
})

test('readJsonSafe: malformed / empty body -> null (treated as absent, never throws)', async () => {
  const bad = new Request('http://x/', { method: 'POST', body: 'not json' })
  assert.equal(await readJsonSafe(bad), null)
  const empty = new Request('http://x/', { method: 'POST' })
  assert.equal(await readJsonSafe(empty), null)
})
