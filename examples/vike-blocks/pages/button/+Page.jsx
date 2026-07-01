// The button block demo. Each button below is the `button` block rendered through the registry
// (resolvePage + <Blocks>), grouped into rows so variants/sizes sit side by side.
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
        A themed button block. <code>button('Save').variant('primary')</code>; add <code>.to(path)</code> to render a link
        styled as a button, <code>.size('sm')</code> for compact. Colors/radius read vike-themes CSS vars.
      </p>

      <Label>Variants</Label>
      <Row>
        <Btn label="Primary" variant="primary" />
        <Btn label="Secondary" variant="secondary" />
        <Btn label="Ghost" variant="ghost" />
        <Btn label="Danger" variant="danger" />
      </Row>

      <Label>Sizes</Label>
      <Row>
        <Btn label="Small" variant="primary" size="sm" />
        <Btn label="Medium" variant="primary" />
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
