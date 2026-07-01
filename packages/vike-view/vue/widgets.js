// The built-in Vue field widgets + the registry's public surface. The Vue twin of
// vike-view/react/widgets.jsx, as functional components (a function of `{ field, value }` props).
// Importing this module registers the built-ins as a side effect; an extension adds its own
// control with `registerFieldWidget('file', FileField)`.
import { h } from 'vue'
import { registerFieldWidget, getFieldWidget } from './widget-registry.js'

const labelStyle = { display: 'block', color: 'var(--color-muted)', fontSize: '13px', marginBottom: '4px' }
const control = {
  width: '100%',
  padding: '0.5rem 0.6rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg, #fff)',
  color: 'var(--color-text)',
  fontSize: '14px',
  boxSizing: 'border-box',
}
const HTML_INPUT = { email: 'email', date: 'date', integer: 'number', text: 'text' }

// Label + control scaffold shared by every non-checkbox widget.
function labeled(field, controlVnode) {
  return h('div', [
    h('label', { style: labelStyle, for: field.name }, `${field.label}${field.required ? ' *' : ''}`),
    controlVnode,
  ])
}

export const InputField = (props) =>
  labeled(
    props.field,
    h('input', {
      id: props.field.name,
      name: props.field.name,
      type: HTML_INPUT[props.field.widget] ?? 'text',
      required: props.field.required,
      value: props.value ?? '',
      style: control,
    }),
  )
InputField.props = ['field', 'value']

export const TextareaField = (props) => {
  const mono = props.field.widget === 'json'
  return labeled(
    props.field,
    // textarea value is its text content (SSR-correct)
    h('textarea', {
      id: props.field.name,
      name: props.field.name,
      required: props.field.required,
      rows: mono ? 6 : 4,
      style: { ...control, resize: 'vertical', ...(mono ? { fontFamily: 'var(--font-mono, monospace)' } : {}) },
    }, props.value ?? ''),
  )
}
TextareaField.props = ['field', 'value']

export const SelectField = (props) => {
  const options = props.field.options ?? []
  const children = []
  if (!props.field.required) children.push(h('option', { value: '' }, '—'))
  for (const o of options) children.push(h('option', { key: String(o.value), value: o.value }, o.label))
  return labeled(
    props.field,
    h('select', { id: props.field.name, name: props.field.name, required: props.field.required, value: props.value ?? '', style: control }, children),
  )
}
SelectField.props = ['field', 'value']

export const CheckboxField = (props) =>
  h('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' } }, [
    h('input', { type: 'checkbox', name: props.field.name, checked: !!props.value }),
    props.field.label,
  ])
CheckboxField.props = ['field', 'value']

registerFieldWidget('text', InputField)
registerFieldWidget('email', InputField)
registerFieldWidget('date', InputField)
registerFieldWidget('integer', InputField)
registerFieldWidget('longtext', TextareaField)
registerFieldWidget('json', TextareaField)
registerFieldWidget('select', SelectField)
registerFieldWidget('enum', SelectField)
registerFieldWidget('boolean', CheckboxField)

export { registerFieldWidget, getFieldWidget }
