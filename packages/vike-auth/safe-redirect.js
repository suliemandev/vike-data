// Validate a post-login `next` redirect target so it can only point WITHIN this app,
// never an open redirect to another origin. Used at every hop that carries `next`:
// the /auth/request form, the magic-link callback URL, and the /login guard.
//
// Accepts a local absolute path ('/', '/admin', '/admin/users?tab=1'); rejects a
// protocol-relative URL ('//evil.com'), an absolute URL ('https://evil.com'), the
// backslash trick some browsers normalise to '/', and non-strings. Returns the path
// or null (callers fall back to their default home).
export function sanitizeNext(value) {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/')) return null // must be an absolute local path
  if (value.startsWith('//')) return null // protocol-relative -> another origin
  if (value.startsWith('/\\') || value.startsWith('/%5C')) return null // backslash trick
  return value
}
