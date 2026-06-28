export default Page

import React from 'react'

function Page() {
  return (
    <>
      <h1>Introduction</h1>
      <p>
        This is a minimal <a href="https://github.com/brillout/docpress">DocPress</a> documentation
        site themed by <code>vike-themes</code>. Use the <strong>Theme</strong> and <strong>Mode</strong>{' '}
        switchers in the top navigation: the palette is recompiled and applied live, with no reload.
      </p>
      <p>
        DocPress is a React + Vike docs engine that owns its own page shell. <code>vike-themes</code>{' '}
        never imports DocPress and DocPress never imports <code>vike-themes</code>. They meet only at
        a layer of CSS variables.
      </p>
      <h2>What this example demonstrates</h2>
      <ul>
        <li>
          The framework-agnostic core of <code>vike-themes</code> (<code>themeToAppearanceCss</code>)
          compiling brands to CSS variables, scoped to DocPress' <code>body</code>.
        </li>
        <li>
          A theme switcher mounted into DocPress' <code>topNavigation</code> React-node slot.
        </li>
        <li>
          A small <code>theme-bridge.css</code> that maps DocPress' own variables onto the variable
          names <code>vike-themes</code> emits.
        </li>
      </ul>
      <p>
        See <a href="/theming">How theming works</a> for the seam, and{' '}
        <a href="/coverage">Coverage &amp; caveats</a> for what does and does not get themed.
      </p>
    </>
  )
}
