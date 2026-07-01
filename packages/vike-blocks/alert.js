// The `alert` block — a leaf catalog element for a tone-styled notice (info / success / warning /
// danger), defined through the defineBlock seam. Static and dep-free (from-scratch, not harvested);
// the renderers style it on the `var(--color-*)` / `--radius` contract so a theme colors it. The
// example's custom `callout` block stays the "third-party block" teaching demo; this is the built-in.
//
//   alert('Heads up').intent('warning').body('Your trial ends in 3 days.')
//   alert('Saved').intent('success')
import { defineBlock } from './registry.js'

export const alert = defineBlock('alert', {
  build: (title) => ({ title }),
  refine: {
    intent: (intent) => ({ intent }),
    body: (text) => ({ body: text }),
  },
})
