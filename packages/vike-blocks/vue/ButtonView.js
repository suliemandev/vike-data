// The Vue renderer for the `button` block — the Vue twin of react/ButtonView.jsx, the shadcn Base
// button surface. Theme-native; `to` renders an <a> styled as a button, otherwise a real <button>.
// A functional component (no state) that shares the variant/size/hover/focus/disabled styling with
// the React renderer via the button-styles module, so the two can't drift.
import { h } from 'vue'
import { registerBlockRenderer } from './registry.js'
import { buttonStyle, variantKey, BUTTON_STYLE_TAG } from '../button-styles.js'

export const ButtonView = (props) => {
  const { label, variant = 'default', to, size = 'default', disabled = false } = props
  const style = buttonStyle(variant, size, disabled)
  const common = { class: 'vike-blocks-btn', 'data-slot': 'button', 'data-variant': variantKey(variant), style }
  const styleTag = h('style', BUTTON_STYLE_TAG)
  const el = to
    ? // An <a> has no `disabled`; mark it aria-disabled + drop it from the tab order and strip the
      // href so a disabled link-button neither navigates nor focuses.
      h('a', { href: disabled ? undefined : to, 'aria-disabled': disabled || undefined, tabindex: disabled ? -1 : undefined, ...common }, label)
    : h('button', { type: 'button', disabled: disabled || undefined, ...common }, label)
  return [styleTag, el]
}
ButtonView.props = ['label', 'variant', 'to', 'size', 'disabled']

registerBlockRenderer('button', ButtonView)
