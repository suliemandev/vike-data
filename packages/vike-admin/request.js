// Reading the create form's POST, across the two ways Vike surfaces the request.
//
// Vike hands the incoming request to render-time hooks differently depending on how the
// app is served:
//   - a SERVER ADAPTER (Hono / Express / Cloudflare, via @universal-middleware) sets
//     `pageContext._reqWeb` to the Web `Request` — production, and any custom server.
//   - the bare `vite dev` SSR middleware sets `pageContext._nodeDev = { req, res }` to the
//     raw Node `IncomingMessage` / `ServerResponse` — the zero-config dev server.
//
// The admin's create page owns its own POST (no separate endpoint, no middleware that
// can't see the composed schema), so it normalizes both into `{ method, formData() }`.
// `formData()` yields a `URLSearchParams`/`FormData`-shaped object (both expose `.get` /
// `.has`), so callers read fields the same way regardless of environment.

// Parse a urlencoded Node request body into URLSearchParams. HTML forms POST
// `application/x-www-form-urlencoded` by default; multipart (file uploads) is out of
// scope for the MVP. The body stream is intact here — nothing upstream reads it for
// /admin/* paths (vike-auth's middleware only consumes /auth/* bodies).
function readNodeBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(new URLSearchParams(body)))
    req.on('error', reject)
  })
}

// Normalize the request to `{ method, formData() }` from whichever shape Vike provided.
export function readFormRequest(pageContext) {
  const web = pageContext._reqWeb
  if (web) return { method: web.method, formData: () => web.formData() }

  const nodeReq = pageContext._nodeDev?.req
  if (nodeReq) return { method: nodeReq.method, formData: () => readNodeBody(nodeReq) }

  // No request surfaced (e.g. prerender) — treat as a non-mutating GET.
  return { method: 'GET', formData: async () => new URLSearchParams() }
}
