// Runtime-agnostic id/token helpers. The security-relevant property is that a
// token is opaque, URL-safe, and high-entropy; the time helpers gate expiry.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newId, newToken, isoIn, isExpired, nowMs } from '../tokens.js'

test('newId returns a v4-shaped UUID', () => {
  assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('newToken is URL-safe base64 with no padding or +/ characters', () => {
  for (let i = 0; i < 50; i++) {
    const t = newToken()
    assert.match(t, /^[A-Za-z0-9_-]+$/, `token had unsafe chars: ${t}`)
    assert.ok(!t.includes('='), 'token should not be padded')
  }
})

test('newToken encodes 32 bytes (43 base64 chars, unpadded)', () => {
  // ceil(32 / 3) * 4 = 44, minus 1 padding char = 43.
  assert.equal(newToken().length, 43)
})

test('newToken is effectively unique across many draws', () => {
  const seen = new Set()
  for (let i = 0; i < 1000; i++) seen.add(newToken())
  assert.equal(seen.size, 1000)
})

test('isoIn(ms, base) offsets the base by ms and returns ISO', () => {
  const base = Date.parse('2026-01-01T00:00:00.000Z')
  assert.equal(isoIn(60_000, base), '2026-01-01T00:01:00.000Z')
})

test('isoIn(0) returns the base instant', () => {
  const base = Date.parse('2026-06-21T12:00:00.000Z')
  assert.equal(isoIn(0, base), '2026-06-21T12:00:00.000Z')
})

test('isExpired is true at or before the base, false after', () => {
  const base = Date.parse('2026-01-01T00:00:00.000Z')
  assert.equal(isExpired('2025-12-31T23:59:59.000Z', base), true) // past
  assert.equal(isExpired('2026-01-01T00:00:00.000Z', base), true) // exactly now => expired
  assert.equal(isExpired('2026-01-01T00:00:01.000Z', base), false) // future
})

test('nowMs is a millisecond timestamp', () => {
  const t = nowMs()
  assert.equal(typeof t, 'number')
  assert.ok(t > Date.parse('2025-01-01T00:00:00Z'))
})
