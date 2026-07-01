// Reading a form POST across the two ways Vike surfaces the request (a Web Request on server
// adapters, the raw Node request under `vite dev`), normalized to `{ method, formData() }`. The
// generated view page owns its own POST (no separate endpoint), so it reads the submitted form
// the same way regardless of environment. Same shape as vike-admin's request reader.
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

export function readFormRequest(pageContext) {
  const web = pageContext._reqWeb
  if (web) return { method: web.method, formData: () => web.formData() }

  const nodeReq = pageContext._nodeDev?.req
  if (nodeReq) return { method: nodeReq.method, formData: () => readNodeBody(nodeReq) }

  // No request surfaced (e.g. prerender) — treat as a non-mutating GET.
  return { method: 'GET', formData: async () => new URLSearchParams() }
}
