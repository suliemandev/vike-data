// The shared Stripe SDK seam — the reason vike-stripe is ONE package: every billing
// model (subscription, purchase) talks to Stripe through this single place,
// rather than each subpath pulling its own copy.
//
// A real vike-stripe imports the official `stripe` package here. We do not (the
// proof has no network and no Stripe account), but the ONE thing a stub must NOT
// fake is the webhook signature: without it `/stripe/.../webhook` is an
// unauthenticated write. So `constructEvent` below verifies the signature for real,
// using Stripe's own scheme (HMAC-SHA256 over `${timestamp}.${rawBody}`) via Node's
// `crypto`. The shape is `stripe.webhooks.constructEvent(rawBody, signature,
// secret)`, so swapping in the official SDK is a local change confined to this file.
//
// Provider seam: Stripe is the baked-in default. Another provider (vike-paddle)
// would be its own package exposing the same `createBillingProvider`-shaped surface,
// so an app swaps the provider without the billing models changing. We keep that
// seam in mind but do not build the neutral layer yet.
import crypto from 'node:crypto'

const SIGNATURE_SCHEME = 'v1'
// Stripe's default replay window: reject events whose timestamp is more than this
// many seconds from now. Mirrors the SDK's `tolerance` default.
const DEFAULT_TOLERANCE_SECONDS = 300

const nowSeconds = () => Math.floor(Date.now() / 1000)

// HMAC-SHA256 of `${timestamp}.${payload}`, hex-encoded — the value Stripe puts in
// the `v1=` field of `Stripe-Signature`. Exported so tests (and any local signing
// step) can produce a header that verifies, exactly as Stripe does.
export function computeSignature(payload, secret, timestamp) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex')
}

// Build a full `Stripe-Signature` header value: `t=<ts>,v1=<sig>`.
export function signWebhook(payload, secret, timestamp = nowSeconds()) {
  return `t=${timestamp},${SIGNATURE_SCHEME}=${computeSignature(payload, secret, timestamp)}`
}

function parseSignatureHeader(header) {
  const out = { timestamp: null, signatures: [] }
  for (const part of String(header).split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') out.timestamp = Number(value)
    else if (key === SIGNATURE_SCHEME) out.signatures.push(value)
  }
  return out
}

// Constant-time compare of two hex strings, length-safe (timingSafeEqual throws on
// unequal lengths, so guard first — the guard itself is not secret-dependent).
function timingSafeEqualHex(a, b) {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length === 0 || ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

// Verify a RAW webhook body against its `Stripe-Signature` header and the endpoint
// secret, then return the parsed event. Mirrors `stripe.webhooks.constructEvent`:
// throws if the secret/header is missing, the header is malformed, no signature
// matches, or (when a tolerance is set) the timestamp is outside the window. The
// signature covers the exact bytes Stripe sent, so callers MUST pass the raw body —
// a re-serialized object would not verify.
export function constructEvent(
  payload,
  header,
  secret,
  { tolerance = DEFAULT_TOLERANCE_SECONDS, now = nowSeconds } = {},
) {
  if (!secret) throw new Error('vike-stripe: missing webhook signing secret')
  if (!header) throw new Error('vike-stripe: missing Stripe-Signature header')
  const { timestamp, signatures } = parseSignatureHeader(header)
  if (!timestamp || Number.isNaN(timestamp) || signatures.length === 0) {
    throw new Error('vike-stripe: malformed Stripe-Signature header')
  }
  const expected = computeSignature(payload, secret, timestamp)
  if (!signatures.some((sig) => timingSafeEqualHex(sig, expected))) {
    throw new Error('vike-stripe: signature verification failed')
  }
  if (tolerance > 0 && Math.abs(now() - timestamp) > tolerance) {
    throw new Error('vike-stripe: timestamp outside the tolerance window')
  }
  return JSON.parse(payload)
}

export function createStripe({ apiKey, webhookSecret } = {}) {
  return {
    apiKey: apiKey ?? null,
    webhookSecret: webhookSecret ?? null,
    webhooks: {
      // Mirrors stripe.webhooks.constructEvent(rawBody, signature, endpointSecret):
      // verifies the HMAC signature over the raw body before returning the event.
      // The secret defaults to the one this instance was created with.
      constructEvent(rawBody, signature, secret = webhookSecret, opts) {
        return constructEvent(rawBody, signature, secret, opts)
      },
    },
  }
}

// The default shared instance the subpath wirings use. The signing secret comes from
// the environment — an unconfigured deployment rejects every webhook (safe default)
// rather than accepting forgeries.
export const stripe = createStripe({
  apiKey: process.env.STRIPE_API_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
})
