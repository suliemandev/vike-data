import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  webPushTransport, encryptPayload, buildVapidHeader, _importAsPrivate,
} from '../web-push.js'
import { setPushTransport, clearPushTransport, getPushOutbox, clearPushOutbox } from '../index.js'

const { subtle } = (await import('node:crypto')).webcrypto
const b64url = (s) => Buffer.from(s, 'base64url')

// RFC 8291, Appendix A - the authoritative Web Push encryption worked example.
const VECTOR = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  ua_public: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  as_public: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  as_private: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  expected:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

test('encryptPayload reproduces the RFC 8291 Appendix A vector', async () => {
  // Pin the application-server ephemeral keypair + salt to the vector's values, so the
  // output is deterministic and must equal the RFC's published ciphertext.
  const as = await _importAsPrivate(VECTOR.as_private, b64url(VECTOR.as_public))
  const body = await encryptPayload(Buffer.from(VECTOR.plaintext, 'utf8'), VECTOR.ua_public, VECTOR.auth, {
    as,
    salt: b64url(VECTOR.salt),
  })
  assert.equal(body.toString('base64url'), VECTOR.expected)
})

test('a random salt + ephemeral key produce a different body each time (but valid framing)', async () => {
  const a = await encryptPayload(Buffer.from('hi'), VECTOR.ua_public, VECTOR.auth)
  const b = await encryptPayload(Buffer.from('hi'), VECTOR.ua_public, VECTOR.auth)
  assert.notEqual(a.toString('base64url'), b.toString('base64url'))
  // header = salt(16) + rs(4) + idlen(1) + keyid(65); idlen byte is 65, keyid starts with 0x04.
  assert.equal(a.readUInt8(20), 65)
  assert.equal(a.readUInt32BE(16), 4096)
  assert.equal(a.readUInt8(21), 0x04)
})

// A fresh VAPID keypair (P-256) for the signing tests.
async function genVapid() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pubRaw = Buffer.from(await subtle.exportKey('raw', kp.publicKey))
  const jwk = await subtle.exportKey('jwk', kp.privateKey)
  return { publicKey: pubRaw.toString('base64url'), privateKey: jwk.d, verifyKey: kp.publicKey }
}

test('buildVapidHeader signs a verifiable ES256 JWT with the right claims', async () => {
  const { publicKey, privateKey, verifyKey } = await genVapid()
  const endpoint = 'https://push.example.com/send/abc'
  const header = await buildVapidHeader(endpoint, {
    subject: 'mailto:ops@acme.com', vapidPublicKey: publicKey, vapidPrivateKey: privateKey, expSeconds: 1700000000,
  })

  assert.match(header, /^vapid t=.+, k=.+$/)
  const m = header.match(/^vapid t=(.+), k=(.+)$/)
  assert.equal(m[2], publicKey) // the k= field is the VAPID public key

  const [h, c, sig] = m[1].split('.')
  const claims = JSON.parse(Buffer.from(c, 'base64url'))
  assert.equal(claims.aud, 'https://push.example.com') // aud is the endpoint origin
  assert.equal(claims.sub, 'mailto:ops@acme.com')
  assert.equal(claims.exp, 1700000000)

  // The signature verifies against the VAPID public key.
  const ok = await subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, verifyKey,
    Buffer.from(sig, 'base64url'), Buffer.from(`${h}.${c}`, 'utf8'),
  )
  assert.equal(ok, true)
})

test('webPushTransport validates its options', () => {
  assert.throws(() => webPushTransport({ vapidPublicKey: 'x', vapidPrivateKey: 'y' }), /subject/)
  assert.throws(() => webPushTransport({ subject: 'mailto:a@b.c', vapidPrivateKey: 'y' }), /vapidPublicKey and vapidPrivateKey/)
  assert.throws(() => webPushTransport({ subject: 'ftp://nope', vapidPublicKey: 'x', vapidPrivateKey: 'y' }), /subject/)
})

function fakeFetch(response) {
  const calls = []
  const fn = async (url, init) => { calls.push({ url, init }); return response }
  fn.calls = calls
  return fn
}
const okRes = (status = 201) => ({ ok: status >= 200 && status < 300, status })

test('send encrypts, signs, and POSTs to the endpoint with the Web Push headers', async () => {
  const { publicKey, privateKey } = await genVapid()
  const fetch = fakeFetch(okRes(201))
  const t = webPushTransport({ subject: 'mailto:ops@acme.com', vapidPublicKey: publicKey, vapidPrivateKey: privateKey, ttl: 120, fetch })

  const subscription = { endpoint: 'https://push.example.com/send/abc', keys: { p256dh: VECTOR.ua_public, auth: VECTOR.auth } }
  const result = await t.send(subscription, { title: 'Hi', body: 'there' })

  assert.equal(fetch.calls.length, 1)
  const { url, init } = fetch.calls[0]
  assert.equal(url, subscription.endpoint)
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['content-encoding'], 'aes128gcm')
  assert.equal(init.headers['content-type'], 'application/octet-stream')
  assert.equal(init.headers.ttl, '120')
  assert.match(init.headers.authorization, /^vapid t=.+, k=.+$/)
  assert.ok(Buffer.isBuffer(init.body) && init.body.length > 86) // header(86) + ciphertext
  assert.deepEqual(result, { statusCode: 201 })
})

test('send throws on a non-2xx so the queue retries', async () => {
  const { publicKey, privateKey } = await genVapid()
  const t = webPushTransport({ subject: 'mailto:ops@acme.com', vapidPublicKey: publicKey, vapidPrivateKey: privateKey, fetch: fakeFetch(okRes(410)) })
  await assert.rejects(
    () => t.send({ endpoint: 'https://push.example.com/x', keys: { p256dh: VECTOR.ua_public, auth: VECTOR.auth } }, {}),
    /push service responded 410/,
  )
})

test('send rejects a subscription missing keys (never hits the network)', async () => {
  const { publicKey, privateKey } = await genVapid()
  const fetch = fakeFetch(okRes())
  const t = webPushTransport({ subject: 'mailto:ops@acme.com', vapidPublicKey: publicKey, vapidPrivateKey: privateKey, fetch })
  await assert.rejects(() => t.send({ endpoint: 'https://p/x', keys: {} }, {}), /missing p256dh\/auth/)
  assert.equal(fetch.calls.length, 0)
})

test('plugs into the vike-push port: setPushTransport routes a real encrypted send', async () => {
  clearPushTransport()
  clearPushOutbox()
  const { publicKey, privateKey } = await genVapid()
  const fetch = fakeFetch(okRes(201))
  setPushTransport(webPushTransport({ subject: 'mailto:ops@acme.com', vapidPublicKey: publicKey, vapidPrivateKey: privateKey, fetch }))

  // Drive the transport the way the send job does: send(subscription, payload).
  const { getPushTransport } = await import('../index.js')
  await getPushTransport().send(
    { endpoint: 'https://push.example.com/send/abc', keys: { p256dh: VECTOR.ua_public, auth: VECTOR.auth } },
    { title: 'Routed' },
  )
  assert.equal(fetch.calls.length, 1)
  assert.equal(getPushOutbox().length, 0) // the dev outbox was bypassed
  clearPushTransport()
})
