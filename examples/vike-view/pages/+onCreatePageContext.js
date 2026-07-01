// A fixed demo identity on every request, so the owner-scoped write path (views.js `scope`) has a
// `ctx.user` without pulling in the whole auth stack. A REAL app deletes this file and installs
// vike-auth/react, whose own onCreatePageContext resolves the session cookie to the same
// `pageContext.user` shape ({ id, email, name }). The data hook only reads it on the server.
export default function onCreatePageContext(pageContext) {
  pageContext.user = { id: 'u_demo', email: 'demo@example.com', name: 'Demo User' }
}
