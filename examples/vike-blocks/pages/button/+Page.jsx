// The button block demo. Each button below is the `button` block rendered through the registry
// (resolvePage + <Blocks>), grouped into rows so variants/sizes sit side by side. The surface is
// the shadcn Base button — six variants, four sizes, a focus-visible ring, hover, and disabled.
import { resolvePage } from 'vike-blocks'
import { Blocks } from 'vike-blocks/react'

// Render a single button block from its props.
const Btn = (props) => <Blocks sections={resolvePage({ sections: [{ block: 'button', ...props }] }).sections} />
const Row = ({ children }) => <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.4rem 0 1.4rem' }}>{children}</div>
const Label = ({ children }) => <div style={{ fontSize: 13, color: '#64748b', margin: '0 0 0.4rem' }}>{children}</div>

export default function ButtonPage() {
  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Button block</h1>
      <p style={{ color: '#64748b', lineHeight: 1.6 }}>
        The shadcn Base button, theme-native. <code>button('Save').variant('default')</code>; add <code>.to(path)</code> to render a
        link styled as a button, <code>.size('sm')</code> for compact, <code>.disabled()</code> to disable. Our old names still
        work (<code>primary</code> {'->'} <code>default</code>, <code>danger</code> {'->'} <code>destructive</code>). Colors/radius read vike-themes CSS vars.
      </p>

      <Label>Variants</Label>
      <Row>
        <Btn label="Default" variant="default" />
        <Btn label="Secondary" variant="secondary" />
        <Btn label="Outline" variant="outline" />
        <Btn label="Ghost" variant="ghost" />
        <Btn label="Link" variant="link" />
        <Btn label="Destructive" variant="destructive" />
      </Row>

      <Label>Sizes (sm / default / lg / icon)</Label>
      <Row>
        <Btn label="Small" size="sm" />
        <Btn label="Default" />
        <Btn label="Large" size="lg" />
        <Btn label="+" size="icon" aria-label="Add" />
      </Row>

      <Label>Disabled</Label>
      <Row>
        <Btn label="Default" disabled />
        <Btn label="Outline" variant="outline" disabled />
        <Btn label="Destructive" variant="destructive" disabled />
      </Row>

      <Label>As a link (declarative nav)</Label>
      <Row>
        <Btn label="Back to catalog" variant="secondary" to="/" />
      </Row>

      <p style={{ marginTop: '1rem' }}>
        <a href="/">{'<-'} back to catalog</a>
      </p>
    </div>
  )
}
