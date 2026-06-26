// The Vike binding's request handler: a universal middleware (server-agnostic,
// runs on Hono / Express / Cloudflare / the Vike dev server alike). It owns the
// auth ENDPOINTS and the session cookie; it does not render the login UI (that
// is the app's, or a future vike-auth/react's, job).
//
// As a universal middleware it runs on every request inside Vike's onion. For
// non-/auth/ paths it returns nothing and the request falls through to Vike's
// renderer. For /auth/* it short-circuits with a Response.
//
//   POST /auth/request   form `email`  -> issue a magic link (dev: show the link)
//   GET  /auth/callback?token=...       -> verify, open a session, set cookie, redirect /
//   POST /auth/logout                   -> destroy the session, clear cookie, redirect /
//
// NOTE: resolving the current user for RENDERING is done in oncreate.js, not
// here. In Vike 0.4.259 a +middleware's returned context is not bridged into
// pageContext, so the middleware can't hand `user` to onRenderHtml. See the
// README design note — if Vike bridges universal-middleware context into
// pageContext, the two halves collapse into one hook.
import { enhance, MiddlewareOrder } from '@universal-middleware/core'
import { sendMail } from 'vike-mail'
import { SESSION_COOKIE } from './constants.js'
import { parseCookies, serializeCookie } from './cookie.js'
import { sanitizeNext } from './safe-redirect.js'

const html = (status, body) =>
  new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>vike-auth</title></head>` +
      `<body style="font-family:ui-monospace,monospace;max-width:640px;margin:3rem auto;line-height:1.6;color:#222;">${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

// Navigate to `to` and set the session cookie. We use a 200 + meta-refresh
// rather than a 3xx redirect on purpose: in Vike 0.4.259, a redirect Response
// returned from a universal middleware crashes Vike's request logger, which
// looks for a `Location` header with a capital L while the Web `Headers` object
// has lower-cased it to `location` (`assert(headerRedirect)` throws). 200 +
// meta-refresh sets the cookie and navigates without tripping that path.
// (Finding for Vike: case-insensitive header lookup in logHttpResponse.)
const navigate = (to, cookie) => {
  const headers = { 'Content-Type': 'text/html; charset=utf-8' }
  if (cookie) headers['Set-Cookie'] = cookie
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
      `<meta http-equiv="refresh" content="0; url=${esc(to)}"/></head>` +
      `<body><a href="${esc(to)}">Continue</a></body></html>`,
    { status: 200, headers },
  )
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// `secure` defaults to true (fail closed): the session cookie carries `; Secure`
// unless the caller explicitly opts out for local http dev. `dev` only controls
// the inline magic-link convenience; it no longer governs the Secure flag, so a
// deployment that forgets `NODE_ENV=production` cannot silently ship the cookie
// over plain HTTP. See vike-middleware.js for how the default wiring derives both.
export function createAuthMiddleware(auth, { dev = false, secure = true } = {}) {
  const sessionCookie = (token, maxAgeSec) =>
    serializeCookie(SESSION_COOKIE, token, { maxAge: maxAgeSec, sameSite: 'Lax', secure })

  // Vike dedupes identical `middleware` contributions by extension identity
  // (vikejs/vike#3354, fixed in 0.4.259), so this runs once per request even when
  // several extensions self-install vike-auth (the app + vike-teams + vike-stripe).
  // No per-request idempotency guard is needed; reading the body once is safe.
  async function authMiddleware(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/auth/')) return // fall through to Vike

    // --- issue a magic link -------------------------------------------------
    if (url.pathname === '/auth/request' && request.method === 'POST') {
      const form = await request.formData()
      const result = await auth.requestMagicLink(form.get('email'))
      if (!result.ok) {
        return html(400, `<p>Could not send a link: <code>${esc(result.error)}</code>.</p><p><a href="/">Back</a></p>`)
      }
      // Carry the intended destination (where a guard bounced the user from) through
      // the magic link, so the callback can return them there. Validated to a local
      // path so the link can never become an open redirect.
      const next = sanitizeNext(form.get('next'))
      const nextParam = next ? `&next=${encodeURIComponent(next)}` : ''
      const link = `${url.origin}/auth/callback?token=${encodeURIComponent(result.token)}${nextParam}`
      // Deliver the link through vike-mail's neutral PORT (queued via vike-queue).
      // vike-auth depends only on the port, never a concrete provider (the same shape
      // as depending on @universal-orm/core, not Drizzle): with no transport registered
      // vike-mail's dev console/outbox transport records it, and an app that registers a
      // real transport (Resend/SES) actually emails it. Delivery must not reveal whether
      // the address exists, so a failure is swallowed and the neutral notice still shows.
      // INVARIANT: requestMagicLink issues a token for ANY syntactically-valid email with
      // no DB existence check, so there is no existence-dependent branch here and thus no
      // timing oracle. Do NOT add an "only send if the user exists" path: that would make
      // delivery latency leak existence, which swallowing the error alone would not close.
      try {
        await sendMail({
          to: result.email,
          subject: 'Your sign-in link',
          html: `<p>Click to sign in:</p><p><a href="${esc(link)}">${esc(link)}</a></p><p>This link expires shortly and can only be used once.</p>`,
          text: `Sign in: ${link}`,
        })
      } catch (err) {
        console.error('[vike-auth] failed to hand the magic link to vike-mail:', err)
      }
      // In dev we also surface the link inline for convenience (no inbox to open).
      const devLink = dev
        ? `<p>Dev mode: the link was handed to vike-mail. For convenience:</p><p><a href="${esc(link)}">${esc(link)}</a></p>`
        : `<p>If that address has an account, a sign-in link is on its way.</p>`
      return html(200, `<h2>Check your inbox</h2>${devLink}<p><a href="/">Back</a></p>`)
    }

    // --- verify a magic link, open a session --------------------------------
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      const result = await auth.redeemMagicLink(url.searchParams.get('token') || '')
      if (!result.ok) {
        return html(401, `<h2>Sign-in failed</h2><p><code>${esc(result.error)}</code></p><p><a href="/">Try again</a></p>`)
      }
      // Return to where the user was originally headed (carried through the link),
      // falling back to the site root. Re-validated here, never trusting the URL.
      const next = sanitizeNext(url.searchParams.get('next')) || '/'
      return navigate(next, sessionCookie(result.session.token, Math.floor(auth.sessionTtlMs / 1000)))
    }

    // --- logout -------------------------------------------------------------
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      const token = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE]
      await auth.destroySession(token)
      return navigate('/', sessionCookie('', 0))
    }

    return html(404, `<p>Unknown auth route.</p>`)
  }

  // order = AUTHENTICATION marks this as a middleware (not a route handler) and
  // places it in the conventional slot; no `path` so it sees every request.
  return enhance(authMiddleware, { name: 'vike-auth', order: MiddlewareOrder.AUTHENTICATION })
}
