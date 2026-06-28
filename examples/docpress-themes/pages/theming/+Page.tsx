export default Page

import React from 'react'

function Page() {
  return (
    <>
      <h1>How theming works</h1>
      <p>The integration has three moving parts and no shared imports between the two projects.</p>

      <h2>1. The agnostic core compiles tokens to CSS variables</h2>
      <p>
        <code>vike-themes</code> brands are plain token objects (<code>defineTheme</code>). Its core
        function <code>themeToAppearanceCss(theme, appearance)</code> returns a{' '}
        <code>:root &#123; --color-*: … &#125;</code> block — a pure string, zero framework
        dependencies.
      </p>

      <h2>2. The switcher lives in DocPress' top-nav slot</h2>
      <p>
        DocPress accepts a <code>topNavigation</code> React node. The <code>ThemeMenu</code> component
        rendered there calls the core compiler and appends the resulting{' '}
        <code>&lt;style&gt;</code> to <code>&lt;head&gt;</code> on each change, persisting the choice
        in a cookie. This is what a per-framework <code>ThemeProvider</code> does internally; here we
        drive it by hand because DocPress is not a <code>vike-react</code> app and would not honor
        vike-themes' <code>Wrapper</code> hook.
      </p>

      <h2>3. The bridge maps the two variable vocabularies — at the right scope</h2>
      <p>
        The load-bearing lesson of this spike: DocPress declares its color variables on{' '}
        <code>body</code>, not <code>:root</code> (<code>body &#123; --color-text &#125;</code>,{' '}
        <code>body &#123; --color-bg-white &#125;</code>). A <code>:root</code> override is therefore
        shadowed by the closer <code>body</code> declaration and paints nothing. So both the injected
        theme and the name bridge target <code>body</code>:
      </p>
      <pre>
        <code>{`body {\n  /* vike-themes vars, emitted by themeToAppearanceCss(theme, mode, 'body') */\n  --color-text: …;\n  --color-bg: …;\n  /* bridge: DocPress reads --color-bg-white */\n  --color-bg-white: var(--color-bg);\n}`}</code>
      </pre>
      <p>
        Appended last to <code>&lt;head&gt;</code>, this wins over DocPress' own{' '}
        <code>body &#123; --color-bg-white: #fdfdfd &#125;</code> by source order. That alias is the
        adapter glue that, per issue #327, belongs in vike-data — not in DocPress and not in the theme
        package.
      </p>
    </>
  )
}
