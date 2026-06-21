// Runtime-agnostic id + token helpers, built on Web Crypto (available in Node
// 19+, Deno, Bun, and Cloudflare Workers) so the auth core runs wherever the
// universal middleware does.
const webcrypto = globalThis.crypto

export const newId = () => webcrypto.randomUUID()

// An opaque, high-entropy token (URL-safe base64 of 32 random bytes). Opaque is
// deliberate: the session/magic-link value carries no claims — it is a lookup
// key into the store, so a token is meaningless once its row is deleted.
export function newToken() {
  const bytes = new Uint8Array(32)
  webcrypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const nowMs = () => Date.now()
export const isoIn = (ms, base = Date.now()) => new Date(base + ms).toISOString()
export const isExpired = (iso, base = Date.now()) => new Date(iso).getTime() <= base
