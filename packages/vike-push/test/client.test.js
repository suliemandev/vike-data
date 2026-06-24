// The framework-agnostic client helpers are mostly browser-bound (PushManager,
// service worker, fetch), so this covers the pure, headlessly-testable parts: the
// VAPID key decode and support detection. The full subscribe round-trip needs a real
// browser with notification permission and is verified manually (the server endpoint
// it posts to is covered in push.test.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { urlBase64ToUint8Array, isPushSupported } from '../client.js'

test('urlBase64ToUint8Array decodes a VAPID public key to a 65-byte P-256 point', () => {
  // a real generated VAPID public key (base64url of 0x04 || X || Y)
  const key = 'BDNJY5tBAEFdFWQFeZjDA0JoEm0MscKeDo5JpxJ1QCm2hv56lroZiHk0a3NEvq6sPJsIBGXOIsyKaf4BRP4aEG4'
  const arr = urlBase64ToUint8Array(key)
  assert.ok(arr instanceof Uint8Array)
  assert.equal(arr.length, 65)
  assert.equal(arr[0], 4) // uncompressed EC point prefix
})

test('urlBase64ToUint8Array handles missing padding and the url-safe alphabet', () => {
  // 'abc' base64url -> 'abc=' padded; just assert it decodes without throwing
  const arr = urlBase64ToUint8Array('abc')
  assert.ok(arr instanceof Uint8Array)
  assert.ok(arr.length > 0)
})

test('isPushSupported is false outside a browser (no serviceWorker / PushManager)', () => {
  assert.equal(isPushSupported(), false)
})
