// The button block: a leaf catalog element (defineBlock) with variant / size / to / disabled
// refinements, rendered on the shadcn Base surface. The renderer is not node:test-tested (JSX/Vue),
// so this covers the agnostic builder + resolve plus the shared style module (variant/size aliasing
// + the states style tag) the two renderers share.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { button, definePage, resolvePage, hasBlock } from '../index.js'
import { variantKey, sizeKey, VARIANTS, SIZES, buttonStyle, BUTTON_STYLE_TAG } from '../button-styles.js'

test('button is registered', () => {
  assert.ok(hasBlock('button'))
})

test('the builder collapses to a plain descriptor', () => {
  assert.deepEqual(button('Save').build(), { block: 'button', label: 'Save' })
  assert.deepEqual(button('Save').variant('default').build(), { block: 'button', label: 'Save', variant: 'default' })
  assert.deepEqual(button('Delete').variant('destructive').disabled().build(), {
    block: 'button',
    label: 'Delete',
    variant: 'destructive',
    disabled: true,
  })
  assert.deepEqual(button('Back').variant('ghost').to('/back').size('sm').build(), {
    block: 'button',
    label: 'Back',
    variant: 'ghost',
    to: '/back',
    size: 'sm',
  })
})

test('resolves as a pass-through section', () => {
  const out = resolvePage(definePage({ sections: [button('Go').variant('secondary')] }))
  assert.equal(out.sections[0].block, 'button')
  assert.deepEqual(out.sections[0].resolved, { label: 'Go', variant: 'secondary' })
})

test('the shadcn Base variant + size sets are complete', () => {
  assert.deepEqual(Object.keys(VARIANTS).sort(), ['default', 'destructive', 'ghost', 'link', 'outline', 'secondary'])
  assert.deepEqual(Object.keys(SIZES).sort(), ['default', 'icon', 'lg', 'sm'])
})

test('historical names alias for back-compat (primary/danger, size md)', () => {
  assert.equal(variantKey('primary'), 'default')
  assert.equal(variantKey('danger'), 'destructive')
  assert.equal(variantKey('outline'), 'outline') // a canonical name is unchanged
  assert.equal(variantKey(undefined), 'default') // unset -> default
  assert.equal(sizeKey('md'), 'default')
  assert.equal(sizeKey('lg'), 'lg')
})

test('buttonStyle wires the hover color and disabled cursor', () => {
  const enabled = buttonStyle('primary', 'md', false)
  assert.equal(enabled.background, VARIANTS.default.bg) // primary aliased to default
  assert.equal(enabled['--btn-bg-hover'], VARIANTS.default.hover)
  assert.equal(enabled.cursor, 'pointer')
  assert.equal(enabled.height, SIZES.default.height) // md aliased to default
  assert.equal(buttonStyle('default', 'default', true).cursor, 'default') // disabled

  const icon = buttonStyle('default', 'icon', false)
  assert.equal(icon.width, SIZES.icon.width) // the icon size is square (has a width)
})

test('the states style tag covers hover, focus-visible and disabled', () => {
  assert.match(BUTTON_STYLE_TAG, /:hover\{background:var\(--btn-bg-hover\)\}/)
  assert.match(BUTTON_STYLE_TAG, /:focus-visible/)
  assert.match(BUTTON_STYLE_TAG, /aria-disabled="true"\]\{opacity:\.5/)
})
