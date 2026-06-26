// The render-side half of the guards tier: resolve EACH declared guard's session cookie to
// its user and put them on `pageContext.guards[name].user`. The counterpart to oncreate.js
// (which resolves the default `pageContext.user`); a page reads `pageContext.guards.admin.user`
// to know who is signed into the admin guard, independently of the client guard or the
// default user.
//
// Wired by the guards config (react/guards/+config.js) as an ADDITIONAL onCreatePageContext
// hook (Vike runs all contributed hooks), pinned server-only there — the cookies are
// HttpOnly, so they only resolve server-side, and a client run would null everyone out.
// Inert when no guard is declared: the loop is empty and `pageContext.guards` is left unset,
// so the default single-subject app is unchanged.
import { getGuards } from './guards.js'
import { parseCookies } from './cookie.js'

export default async function onCreateGuardsPageContext(pageContext) {
  // Defense in depth: the guards config pins this hook to { server: true }, but bail on the
  // client anyway (no cookie there) for any consumer that wires it without the env override.
  if (pageContext.isClientSide) return
  const guards = getGuards()
  if (!guards.length) return

  const cookies = parseCookies(pageContext.headers?.cookie)
  const resolved = {}
  for (const guard of guards) {
    const token = cookies[guard.cookieName]
    const session = token ? await guard.instance.authenticate(token) : null
    // The SAME plain, serializable user view the default hook exposes ({ id, email, name }),
    // safe to pass to the client. `user` is null when this guard has no live session — a
    // visitor signed into `admin` but not `client` gets `{ admin: { user }, client: { user: null } }`.
    resolved[guard.name] = {
      user: session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null,
    }
  }
  pageContext.guards = resolved
}
