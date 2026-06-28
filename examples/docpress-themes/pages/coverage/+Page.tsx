export default Page

import React from 'react'

function Page() {
  return (
    <>
      <h1>Coverage &amp; caveats</h1>
      <p>
        The mechanism works, but how much of DocPress actually re-colors depends on DocPress, not on{' '}
        <code>vike-themes</code>.
      </p>

      <h2>What themes cleanly (measured)</h2>
      <ul>
        <li>
          Page background — DocPress paints it with <code>body &#123; background: var(--color-bg-white) &#125;</code>;
          the bridge aliases <code>--color-bg-white</code> to <code>--color-bg</code> on{' '}
          <code>body</code>. Verified flipping <code>#ffffff</code> → <code>#06110c</code> across
          brand + dark mode.
        </li>
        <li>
          Body text — DocPress reads <code>--color-text</code> on <code>body</code>; the same
          variable name vike-themes emits. Verified <code>#16181d</code> → <code>#e7f5ee</code>.
        </li>
        <li>Content links and anything else reading the bridged variables.</li>
      </ul>

      <h2>What does not theme</h2>
      <p>
        The top navigation bar, nav shadows and hover tints, borders, and code-block chrome stay
        fixed. DocPress paints those with <code>rgba(0, 0, 0, …)</code> literals (or higher-specificity
        rules) that read no themeable variable, and it ships no dark-mode stylesheet of its own. So a
        dark appearance flips the page body but leaves the top bar light — visible in this very page.
      </p>

      <h2>The real conclusion</h2>
      <p>
        A <em>complete</em> theming integration is not a bigger bridge — it needs DocPress to
        tokenize its own palette (read a consistent set of <code>--color-*</code> variables and ship
        a dark set). That is a change inside DocPress, and DocPress is currently marked “only meant
        to be used by Vike and Telefunc.” So the open question for #327 is upstream intent, not more
        adapter code on our side.
      </p>

      <h2>vike-layouts is intentionally out of scope</h2>
      <p>
        DocPress already owns its shell, navigation and menu. <code>vike-layouts</code> is also a
        shell system, so the two overlap rather than compose, and a single-shell docs site has no use
        for per-page shell switching. This example deliberately integrates themes only.
      </p>
    </>
  )
}
