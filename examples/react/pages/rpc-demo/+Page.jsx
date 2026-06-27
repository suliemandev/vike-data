// Demo for the Telefunc RBAC seam (#110): the same authorization that gates the
// admin page now gates an RPC. The calls run client-side (useEffect), hitting
// /_telefunc, which vike-rbac's middleware serves with the signed-in user on the
// Telefunc context — so userCount()'s requirePermission('users.view') decides on
// the SAME can() as the admin's canView.
//
//   Ada  (admin)  -> whoami shows admin; userCount returns a number.
//   Alan (member) -> whoami shows member; userCount is Forbidden (Abort).
//   anon          -> whoami null; userCount Forbidden.
import { useEffect, useState } from 'react'
import { whoami, userCount } from './stats.telefunc.js'

export default function Page() {
  const [me, setMe] = useState(undefined)
  const [count, setCount] = useState(undefined)
  const [denied, setDenied] = useState(null)

  useEffect(() => {
    whoami().then(setMe)
    userCount()
      .then(setCount)
      .catch((err) => {
        // Telefunc serializes a thrown Abort to the client as err.isAbort, carrying
        // the value we passed (Abort('Forbidden')); anything else is a real error.
        if (err && err.isAbort) setDenied(err.abortValue || 'Forbidden')
        else setDenied('Error')
      })
  }, [])

  return (
    <main style={{ display: 'grid', gap: '1rem', maxWidth: 560, margin: '0 auto' }}>
      <h1>RPC authorization</h1>
      <p>
        These results come from <code>*.telefunc.js</code> server functions called directly from the browser. The
        guarded one runs the same <code>can(user, 'users.view')</code> as the admin panel.
      </p>

      <section>
        <h2 style={{ marginBottom: '0.25rem' }}>whoami()</h2>
        {me === undefined ? (
          <p>Loading…</p>
        ) : me === null ? (
          <p>
            Signed out. <a href="/login">Sign in</a> as <code>ada@example.com</code> (admin) or{' '}
            <code>alan@example.com</code> (member).
          </p>
        ) : (
          <pre style={{ margin: 0 }}>{JSON.stringify(me, null, 2)}</pre>
        )}
      </section>

      <section>
        <h2 style={{ marginBottom: '0.25rem' }}>userCount() — requires users.view</h2>
        {count !== undefined ? (
          <p>
            There are <strong>{count}</strong> users. (You hold <code>users.view</code>.)
          </p>
        ) : denied ? (
          <p>
            Denied: <code>{denied}</code>. The RPC refused the call, exactly as the admin page would.
          </p>
        ) : (
          <p>Loading…</p>
        )}
      </section>
    </main>
  )
}
