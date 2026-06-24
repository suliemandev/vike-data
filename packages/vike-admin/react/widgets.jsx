// The built-in field widgets + the registry's public surface. Importing this module registers
// the built-ins as a side effect (FormFields imports it for exactly that), and re-exports
// `registerFieldWidget` / `getFieldWidget` so an extension adds its own control with one import:
//
//   import { registerFieldWidget } from 'vike-admin/react/widgets'
//   registerFieldWidget('file', FileField)   // a column marked .as('file') now renders this
//
// Each widget is a component `({ field, value })`: `field` is the resolved form field
// ({ name, label, required, widget, options? }, from resolve.js viewFields), `value` pre-fills
// on edit. No React import — vike-react uses the automatic JSX runtime, matching the rest of the
// package.
import { registerFieldWidget, getFieldWidget } from './widget-registry.js'

const labelStyle = { display: 'block', color: 'var(--color-muted)', fontSize: 13, marginBottom: 4 }
const control = {
  width: '100%',
  padding: '0.5rem 0.6rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius, 8px)',
  background: 'var(--color-bg, #fff)',
  color: 'var(--color-text)',
  fontSize: 14,
  boxSizing: 'border-box',
}

// Label + control scaffold shared by every non-checkbox widget.
function Field({ field, children }) {
  return (
    <div>
      <label style={labelStyle} htmlFor={field.name}>
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      {children}
    </div>
  )
}

// A single-line input; the HTML input `type` follows the widget token so email/date/number get
// the right native control + validation, everything else a plain text box.
const HTML_INPUT = { email: 'email', date: 'date', integer: 'number', text: 'text' }
function InputField({ field, value }) {
  return (
    <Field field={field}>
      <input
        id={field.name}
        name={field.name}
        type={HTML_INPUT[field.widget] ?? 'text'}
        required={field.required}
        defaultValue={value ?? ''}
        style={control}
      />
    </Field>
  )
}

// Multi-line text. `json` gets a monospace box; both submit a raw string (the column stores
// text — no parsing here, so a malformed value is the author's to fix, not a 500).
function TextareaField({ field, value }) {
  const mono = field.widget === 'json'
  return (
    <Field field={field}>
      <textarea
        id={field.name}
        name={field.name}
        required={field.required}
        defaultValue={value ?? ''}
        rows={mono ? 6 : 4}
        style={{ ...control, resize: 'vertical', ...(mono ? { fontFamily: 'var(--font-mono, monospace)' } : {}) }}
      />
    </Field>
  )
}

// A select over `field.options` ({ value, label }[]) — filled by the data hook for a foreign
// key, or by resolve.js from an `.as('enum', { values })` declaration. A non-required field
// gets an empty choice.
function SelectField({ field, value }) {
  const options = field.options ?? []
  return (
    <Field field={field}>
      <select id={field.name} name={field.name} required={field.required} defaultValue={value ?? ''} style={control}>
        {!field.required && <option value="">—</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

// A checkbox; its label wraps the input (no separate Field scaffold).
function CheckboxField({ field, value }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <input type="checkbox" name={field.name} defaultChecked={!!value} />
      {field.label}
    </label>
  )
}

// Built-ins. The storage-derived tokens (boolean / integer / select / text) keep today's
// rendering; the semantic tokens (email / longtext / enum / date / json, #176) add the richer
// controls. An extension registers more (e.g. `file`) via registerFieldWidget.
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
export { InputField, TextareaField, SelectField, CheckboxField }
