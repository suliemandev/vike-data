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
      <p>
        As of DocPress 0.16.46 (<code>brillout/docpress#171</code>) most of the chrome now reads a{' '}
        <code>--color-*</code> variable, so the brand reaches well beyond the page body. Verified
        against the shipped 0.16.46 stylesheets and the variables this example emits:
      </p>
      <ul>
        <li>
          Page background. DocPress paints it with{' '}
          <code>body &#123; background: var(--color-bg-white) &#125;</code>; the bridge aliases{' '}
          <code>--color-bg-white</code> to <code>--color-bg</code> on <code>body</code>.
        </li>
        <li>
          Body and navigation text. DocPress reads <code>--color-text</code> (on <code>body</code>{' '}
          and on the nav items), the same variable name vike-themes emits.
        </li>
        <li>
          Surfaces and gray panels. DocPress reads <code>--color-surface</code> (and the legacy
          alias <code>--color-bg-gray</code>), which the brand sets.
        </li>
        <li>
          Borders. The table, tooltip, and heading rules now read{' '}
          <code>var(--color-border, …)</code>, so they follow the brand instead of a fixed gray.
        </li>
        <li>
          Muted / secondary text via <code>--color-muted</code>.
        </li>
        <li>
          Hover and active row tints. DocPress now derives these with{' '}
          <code>color-mix(in srgb, var(--color-text) …, transparent)</code>, so they track the
          themed text color automatically with no extra variable to set.
        </li>
        <li>
          Content links, which read <code>--color-primary</code>.
        </li>
      </ul>

      <h2>What still does not theme</h2>
      <p>
        A small, specific set of styles still paints with raw <code>rgba(0, 0, 0, …)</code> /{' '}
        hex literals that read no variable, so the brand cannot reach them:
      </p>
      <ul>
        <li>Code-block and inline-code backgrounds, and the diff add / remove tints.</li>
        <li>The code-block tab and copy chrome.</li>
        <li>Note / callout backgrounds, and buttons.</li>
        <li>
          The nav divider shadow reads <code>--color-shadow</code>, which DocPress tokenized but this
          example&apos;s brands do not set, so it keeps its default. A brand that emits a{' '}
          <code>shadow</code> token would color it too.
        </li>
      </ul>

      <h2>The real conclusion</h2>
      <p>
        The earlier version of this page concluded that a complete integration needed DocPress to
        tokenize its palette and ship a dark set, an upstream change that had not happened. As of{' '}
        <code>#171</code> it largely has: DocPress reads a consistent set of <code>--color-*</code>{' '}
        variables (text, bg, surface, border, muted, primary, shadow, active) and ships an opt-in
        dark set behind <code>.dark</code> / <code>[data-theme=&quot;dark&quot;]</code>. So the brand
        now reaches the background, text, surfaces, borders, hover tints, and links through the CSS
        variable seam alone, no fork. What is left is narrow: tokenizing the handful of code-block,
        callout, diff, and button literals listed above. That is a small upstream follow-up, not the
        whole-palette gap this page used to describe.
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
