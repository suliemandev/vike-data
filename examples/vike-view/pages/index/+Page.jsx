// Home: two links, no data. Everything interesting is on the two routes it points at.
export default function HomePage() {
  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <h1 style={{ marginTop: 0 }}>vike-view example</h1>
      <p>
        One <code>defineSchema('posts')</code> drives a full CRUD page -- zero bespoke UI code. The schema is the intent,
        the view is derived.
      </p>
      <ul>
        <li>
          <a href="/posts">/posts</a> -- a <strong>generated</strong> view (list + create form), owner-scoped reads and
          writes. This route is produced by <code>viewPages(views)</code>; there is no page component for it.
        </li>
        <li>
          <a href="/inline">/inline</a> -- the same <code>posts</code> block dropped into a <strong>hand-written</strong>{' '}
          vike-react page (no page-gen). Proves the blocks are composable, not lock-in.
        </li>
      </ul>
    </div>
  )
}
