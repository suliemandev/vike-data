// The Web Push / VAPID transport: the first PRODUCTION transport for the vike-push port.
//
// vike-push ships only the dev console/outbox transport. This is the real one: it encrypts
// the payload (RFC 8291, the aes128gcm content encoding of RFC 8188), signs a VAPID JWT
// (RFC 8292), and POSTs to the subscription's push-service endpoint. The app wires it once,
// the push twin of vike-mail's Resend transport:
//
//   import { setPushTransport } from 'vike-push'
//   import { webPushTransport } from 'vike-push/web-push'
//   setPushTransport(webPushTransport({
//     subject: 'mailto:ops@acme.com',
//     vapidPublicKey: process.env.VAPID_PUBLIC_KEY,   // the same key the client subscribes with
//     vapidPrivateKey: process.env.VAPID_PRIVATE_KEY, // base64url 32-byte scalar, server-side only
//   }))
//
// Zero runtime dependency: all crypto is Node's built-in WebCrypto (ECDH P-256, HKDF,
// AES-128-GCM, ECDSA ES256). An opt-in SUBPATH so nothing Web Push specific is pulled into
// the neutral port unless the app asks for it. SERVER-ONLY (it carries the VAPID private
// key). Delivery runs through vike-queue, so a transient push-service failure is retried;
// this transport throws on a non-2xx so the queue can see it.
//
// The encryption is verified against the RFC 8291 Appendix A test vector (see the tests):
// encryptPayload accepts the ephemeral keypair + salt so the worked example is reproducible.
import { webcrypto } from 'node:crypto'

const { subtle } = webcrypto
const randomBytes = (n) => Buffer.from(webcrypto.getRandomValues(new Uint8Array(n)))

const b64urlToBuf = (s) => Buffer.from(s, 'base64url')
const bufToB64url = (b) => Buffer.from(b).toString('base64url')
const utf8 = (s) => Buffer.from(s, 'utf8')

// Split an uncompressed P-256 public point (0x04 || X(32) || Y(32)) into the JWK x/y a
// WebCrypto EC key import needs.
function pointToXY(point) {
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error('web-push: expected a 65-byte uncompressed P-256 public key')
  }
  return { x: bufToB64url(point.subarray(1, 33)), y: bufToB64url(point.subarray(33, 65)) }
}

// HKDF (extract + expand in one WebCrypto call) -> `length` bytes.
async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])
  const bits = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return Buffer.from(bits)
}

// The RFC 8291 ECDH + double-HKDF key schedule, factored out so a test can pin the
// ephemeral keypair + salt and reproduce Appendix A. `as` is the application-server
// (sender) ephemeral key: { privateKey: CryptoKey, publicRaw: Buffer(65) }.
async function deriveKeys({ uaPublicRaw, authSecret, as, salt }) {
  const uaKey = await subtle.importKey('raw', uaPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256)
  const ecdhSecret = Buffer.from(sharedBits)

  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info"||0x00||ua||as)
  const keyInfo = Buffer.concat([utf8('WebPush: info'), Buffer.from([0]), uaPublicRaw, as.publicRaw])
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  // CEK + NONCE from the aes128gcm content-encoding (RFC 8188), salted with the record salt.
  const cek = await hkdf(salt, ikm, Buffer.concat([utf8('Content-Encoding: aes128gcm'), Buffer.from([0])]), 16)
  const nonce = await hkdf(salt, ikm, Buffer.concat([utf8('Content-Encoding: nonce'), Buffer.from([0])]), 12)
  return { cek, nonce }
}

// Generate (or accept) the application-server ephemeral ECDH keypair.
async function ephemeralKeyPair(injected) {
  if (injected) return injected
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicRaw = Buffer.from(await subtle.exportKey('raw', kp.publicKey))
  return { privateKey: kp.privateKey, publicRaw }
}

// Import an injected application-server private key (test path) from its base64url scalar +
// public point, as an ECDH deriveBits key.
async function importAsPrivate(dB64, publicRaw) {
  const { x, y } = pointToXY(publicRaw)
  const privateKey = await subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: dB64, x, y, ext: true },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
  return { privateKey, publicRaw }
}

const RECORD_SIZE = 4096 // rs; one record per message, payloads must fit (notifications do)

/**
 * Encrypt `payload` (a Buffer) for a subscription per RFC 8291, returning the aes128gcm
 * body (header || ciphertext) ready to POST. `opts.as` (an ephemeral keypair) and
 * `opts.salt` are injectable so the RFC 8291 Appendix A vector is reproducible; both are
 * random by default.
 *
 * @param {Buffer} payload
 * @param {string} p256dh  receiver public key, base64url (subscription.keys.p256dh)
 * @param {string} auth    receiver auth secret, base64url (subscription.keys.auth)
 * @returns {Promise<Buffer>} the aes128gcm body
 */
export async function encryptPayload(payload, p256dh, auth, opts = {}) {
  const uaPublicRaw = b64urlToBuf(p256dh)
  const authSecret = b64urlToBuf(auth)
  const salt = opts.salt ? Buffer.from(opts.salt) : randomBytes(16)
  const as = await ephemeralKeyPair(opts.as)

  const { cek, nonce } = await deriveKeys({ uaPublicRaw, authSecret, as, salt })

  // RFC 8188 single record: plaintext || 0x02 (the last-record delimiter), then AES-128-GCM.
  const record = Buffer.concat([payload, Buffer.from([0x02])])
  if (record.length > RECORD_SIZE) throw new Error('web-push: payload too large for a single record')
  const aesKey = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const sealed = Buffer.from(await subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record))

  // Header: salt(16) || rs(4, big-endian) || idlen(1) || keyid(as_public, 65).
  const header = Buffer.alloc(16 + 4 + 1 + as.publicRaw.length)
  salt.copy(header, 0)
  header.writeUInt32BE(RECORD_SIZE, 16)
  header.writeUInt8(as.publicRaw.length, 20)
  as.publicRaw.copy(header, 21)
  return Buffer.concat([header, sealed])
}

// Build the `Authorization: vapid t=<jwt>, k=<publicKey>` header for an endpoint (RFC 8292).
async function buildVapidHeader(endpoint, { subject, vapidPublicKey, vapidPrivateKey, expSeconds }) {
  const aud = new URL(endpoint).origin
  const header = bufToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bufToB64url(utf8(JSON.stringify({ aud, exp: expSeconds, sub: subject })))
  const signingInput = `${header}.${claims}`

  const { x, y } = pointToXY(b64urlToBuf(vapidPublicKey))
  const signKey = await subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vapidPrivateKey, x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // WebCrypto ECDSA returns the raw r||s (IEEE P1363), which is exactly the JOSE form.
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, utf8(signingInput))
  const jwt = `${signingInput}.${bufToB64url(Buffer.from(sig))}`
  return `vapid t=${jwt}, k=${vapidPublicKey}`
}

export { buildVapidHeader }

const VALID_SUBJECT = /^(mailto:|https?:\/\/)/

/**
 * Build a Web Push / VAPID transport.
 *
 * @param {object} opts
 * @param {string} opts.subject         VAPID `sub`: a `mailto:` or `https?://` contact (required).
 * @param {string} opts.vapidPublicKey  base64url uncompressed P-256 point (the client's applicationServerKey).
 * @param {string} opts.vapidPrivateKey base64url 32-byte private scalar. Server-side only.
 * @param {number} [opts.ttl=86400]     push-service TTL header, seconds.
 * @param {Function} [opts.fetch]       fetch override (testing). Defaults to the global fetch.
 * @returns {{ name: string, send: (subscription: object, payload: any) => Promise<object> }}
 */
export function webPushTransport({ subject, vapidPublicKey, vapidPrivateKey, ttl = 86400, fetch } = {}) {
  if (!subject || !VALID_SUBJECT.test(subject)) {
    throw new Error('webPushTransport: a `subject` (mailto: or https URL) is required')
  }
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('webPushTransport: vapidPublicKey and vapidPrivateKey are required')
  }
  const doFetch = fetch ?? globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new Error('webPushTransport: no fetch available (Node 18+ or pass opts.fetch)')
  }

  return {
    name: 'web-push',
    async send(subscription, payload) {
      const endpoint = subscription?.endpoint
      const keys = subscription?.keys || {}
      if (!endpoint) throw new Error('webPushTransport: subscription has no endpoint')
      if (!keys.p256dh || !keys.auth) throw new Error('webPushTransport: subscription is missing p256dh/auth keys')

      const bytes = utf8(typeof payload === 'string' ? payload : JSON.stringify(payload))
      const body = await encryptPayload(bytes, keys.p256dh, keys.auth)
      const expSeconds = Math.floor(Date.now() / 1000) + 12 * 60 * 60 // VAPID exp, max 24h per spec
      const authorization = await buildVapidHeader(endpoint, { subject, vapidPublicKey, vapidPrivateKey, expSeconds })

      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: {
          authorization,
          'content-encoding': 'aes128gcm',
          'content-type': 'application/octet-stream',
          ttl: String(ttl),
        },
        body,
      })
      if (!res.ok) {
        // 404/410 mean the subscription is gone (pruning the row is a sensible follow-up);
        // every non-2xx throws so vike-queue retries per the job's maxAttempts.
        throw new Error(`webPushTransport: push service responded ${res.status}`)
      }
      return { statusCode: res.status }
    },
  }
}

// Test-only seam: build an injected application-server keypair from the RFC vector's keys.
export const _importAsPrivate = importAsPrivate
