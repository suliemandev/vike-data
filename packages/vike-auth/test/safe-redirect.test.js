// sanitizeNext: a `next` redirect target is only honoured if it points within this
// app. Anything that could leave the origin (or trick a browser into it) is rejected.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeNext } from '../safe-redirect.js'

test('accepts local absolute paths', () => {
  assert.equal(sanitizeNext('/'), '/')
  assert.equal(sanitizeNext('/admin'), '/admin')
  assert.equal(sanitizeNext('/admin/users?tab=1'), '/admin/users?tab=1')
})

test('rejects anything that could leave the origin', () => {
  assert.equal(sanitizeNext('//evil.com'), null) // protocol-relative
  assert.equal(sanitizeNext('https://evil.com'), null) // absolute URL
  assert.equal(sanitizeNext('http://evil.com'), null)
  assert.equal(sanitizeNext('/\\evil.com'), null) // backslash trick
  assert.equal(sanitizeNext('/%5Cevil.com'), null) // encoded backslash
  assert.equal(sanitizeNext('admin'), null) // not absolute
})

test('rejects non-strings', () => {
  assert.equal(sanitizeNext(null), null)
  assert.equal(sanitizeNext(undefined), null)
  assert.equal(sanitizeNext(42), null)
})
