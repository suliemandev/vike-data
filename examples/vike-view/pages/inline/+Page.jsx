// A normal, hand-written vike-react page. The table in the middle is vike-view's <ListView> block,
// imported and rendered directly with columns + rows from the sibling +data.js. No viewPages, no
// generated page -- just a block component composed into JSX the app owns. This is the proof that
// blocks are not lock-in: adopt one on a page you already have, keep everything else.
import { useData } from 'vike-react/useData'
import { ListView } from 'vike-view/react'

export default function InlinePage() {
  const { columns, rows } = useData()
  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <h1 style={{ marginTop: 0 }}>Inline block (no page-gen)</h1>
      <p>
        This page is ordinary vike-react code. The table below is vike-view's <code>&lt;ListView&gt;</code> block, dropped
        in directly -- same <code>posts</code> schema, no generated page.
      </p>
      <ListView table="posts" columns={columns} rows={rows} emptyLabel="No posts yet." />
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/posts">Create a post on the generated view -&gt;</a>
      </p>
    </div>
  )
}
