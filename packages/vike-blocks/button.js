// The `button` block — a leaf catalog element, defined through the defineBlock seam. Display +
// declarative navigation for now: `.to(path)` renders an <a> styled as a button (behaviour that
// DOES something is the actions axis, #385, and can't be an inline closure in serializable config).
// The renderer draws the shadcn Base surface: `.variant()` picks the style
// (default / secondary / outline / ghost / link / destructive — our old primary/danger alias onto
// default/destructive), `.size()` the scale (sm / default / lg / icon; old md aliases default),
// `.disabled()` the disabled state.
//
//   button('Save').variant('default')
//   button('Delete').variant('destructive').disabled()
//   button('Cancel').variant('ghost').to('/back').size('sm')
import { defineBlock } from './registry.js'

export const button = defineBlock('button', {
  build: (label) => ({ label }),
  refine: {
    variant: (v) => ({ variant: v }),
    to: (path) => ({ to: path }),
    size: (s) => ({ size: s }),
    disabled: () => ({ disabled: true }),
  },
})
