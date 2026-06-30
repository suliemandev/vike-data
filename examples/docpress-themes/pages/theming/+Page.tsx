export default Page

import React from 'react'

const swatchRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  margin: '1rem 0 1.25rem',
}

const swatchStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 10px)',
  overflow: 'hidden',
  background: 'var(--color-surface)',
}

const swatchToneStyle = (background: string): React.CSSProperties => ({
  height: 64,
  background,
  borderBottom: '1px solid var(--color-border)',
})

const swatchMetaStyle: React.CSSProperties = {
  padding: '0.7rem 0.8rem',
  display: 'grid',
  gap: 4,
}

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
      <p>
        The brands in <code>themes.ts</code> only author <code>primary</code>; they do not spell out{' '}
        <code>primary-light</code> or <code>primary-dark</code>. The core now derives those
        automatically, so a theme package can provide one primary color and still emit the
        fuller CSS variable contract.
      </p>
      <pre>
        <code>{`const sunset = defineTheme({\n  name: 'sunset',\n  light: { primary: '#e0560d', /* ... */ },\n  dark: { primary: '#ff7a33', /* ... */ },\n})`}</code>
      </pre>
      <p>
        The cards below consume the derived variables directly. Switching theme or appearance
        updates them live, proving the lighter and darker primary steps are present even though
        the authored theme only set <code>primary</code>.
      </p>
      <div style={swatchRowStyle}>
        <div style={swatchStyle}>
          <div style={swatchToneStyle('var(--color-primary-light)')} />
          <div style={swatchMetaStyle}>
            <strong style={{ color: 'var(--color-text)' }}>Primary Light</strong>
            <code style={{ color: 'var(--color-muted)' }}>var(--color-primary-light)</code>
            <span style={{ color: 'var(--color-muted)' }}>Useful for softer fills and hover surfaces.</span>
          </div>
        </div>
        <div style={swatchStyle}>
          <div style={swatchToneStyle('var(--color-primary)')} />
          <div style={swatchMetaStyle}>
            <strong style={{ color: 'var(--color-text)' }}>Primary</strong>
            <code style={{ color: 'var(--color-muted)' }}>var(--color-primary)</code>
            <span style={{ color: 'var(--color-muted)' }}>The single authored color in each theme mode.</span>
          </div>
        </div>
        <div style={swatchStyle}>
          <div style={swatchToneStyle('var(--color-primary-dark)')} />
          <div style={swatchMetaStyle}>
            <strong style={{ color: 'var(--color-text)' }}>Primary Dark</strong>
            <code style={{ color: 'var(--color-muted)' }}>var(--color-primary-dark)</code>
            <span style={{ color: 'var(--color-muted)' }}>Useful for pressed states and higher-contrast accents.</span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          margin: '0 0 1.5rem',
        }}
      >
        <button
          style={{
            border: '1px solid var(--color-primary-dark)',
            background: 'var(--color-primary)',
            color: 'var(--color-primary-text, #fff)',
            borderRadius: 'var(--radius, 10px)',
            padding: '0.55rem 0.9rem',
            font: 'inherit',
          }}
        >
          Solid action
        </button>
        <button
          style={{
            border: '1px solid var(--color-primary)',
            background: 'var(--color-primary-light)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius, 10px)',
            padding: '0.55rem 0.9rem',
            font: 'inherit',
          }}
        >
          Soft action
        </button>
        <a
          href="#"
          style={{
            color: 'var(--color-primary-dark)',
            fontWeight: 600,
            textDecorationColor: 'var(--color-primary-light)',
            textUnderlineOffset: '0.18em',
          }}
        >
          Link using the darker step
        </a>
      </div>

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
