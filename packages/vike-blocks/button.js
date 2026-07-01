// The `button` block — a leaf catalog element, defined through the defineBlock seam. Display +
// declarative navigation for now: `.to(path)` renders an <a> styled as a button (behaviour that
// DOES something is the actions axis, #385, and can't be an inline closure in serializable config).
// `.variant()` picks the intent (primary / secondary / ghost / danger), `.size()` the scale.
//
//   button('Save').variant('primary')
//   button('Cancel').variant('ghost').to('/back')
import { defineBlock } from './registry.js'

export const button = defineBlock('button', {
  build: (label) => ({ label }),
  refine: {
    variant: (v) => ({ variant: v }),
    to: (path) => ({ to: path }),
    size: (s) => ({ size: s }),
  },
})
