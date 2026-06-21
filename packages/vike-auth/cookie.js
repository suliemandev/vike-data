// A tiny, dependency-free cookie reader/writer. The universal-middleware
// ecosystem ships `@universal-middleware/core/cookie`, but it pulls in
// `tough-cookie`; the core auth tier stays zero-dependency on purpose (it must
// run on every runtime universal middleware targets, including the edge), so we
// hand-roll the two functions we actually need.

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    out[key] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

// Serialize a `Set-Cookie` value. Secure HttpOnly defaults; `maxAge` is seconds
// (0 clears the cookie). `secure` is opt-in so http://localhost works in dev.
export function serializeCookie(name, value, opts = {}) {
  let str = `${name}=${encodeURIComponent(value)}`
  str += `; Path=${opts.path || '/'}`
  if (opts.maxAge != null) str += `; Max-Age=${Math.floor(opts.maxAge)}`
  if (opts.httpOnly !== false) str += '; HttpOnly'
  str += `; SameSite=${opts.sameSite || 'Lax'}`
  if (opts.secure) str += '; Secure'
  return str
}
