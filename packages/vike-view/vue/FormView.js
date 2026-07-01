// The Vue renderer for a `form` block — the Vue twin of vike-view/react/FormView.jsx. Wraps the
// shared FormFields (which dispatches each control through the Vue field-widget registry) in a
// ready-to-post <form> with a submit. `values` pre-fills on edit; `action` is where it posts.
import { h } from 'vue'
import { FormFields } from './FormFields.js'

export const FormView = (props) =>
  h('form', { method: 'post', action: props.action, 'data-table': props.table, style: { display: 'grid', gap: '0.9rem' } }, [
    // which table + row this form writes, so the generated page's data hook can dispatch the POST
    h('input', { type: 'hidden', name: '_table', value: props.table }),
    props.id != null ? h('input', { type: 'hidden', name: '_id', value: props.id }) : null,
    h(FormFields, { fields: props.fields, values: props.values }),
    h('div', [h('button', { type: 'submit' }, props.submitLabel ?? 'Save')]),
  ])
FormView.props = ['table', 'fields', 'values', 'action', 'id', 'submitLabel']
