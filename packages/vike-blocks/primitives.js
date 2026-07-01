// The built-in leaf BLOCKS, defined through the same `defineBlock` seam a third party
// uses — so our primitives and someone's `vike-block-rating` are peers, not special cases.
// Each is a lowercase factory (matching vike-view's column()/field() idiom) whose `.build()`
// collapses to a plain leaf-block descriptor; it drops straight into a page's `sections`.
//
//   defineView({
//     sections: [
//       heading('Post').level(2),
//       badge('Draft').tone('warning'),
//       divider(),
//       link('Back to posts').to('/posts'),
//     ],
//   })
//
// Display-only for now (text / heading / badge / divider / link). Interactivity — a button
// that DOES something — is a separate axis (behavior can't be an inline closure in
// serializable config); `link().to(path)` covers declarative navigation meanwhile.
import { defineBlock } from './registry.js'

// A run of text. `.tone()` is an advisory style token ('muted' / 'danger' / ...).
export const text = defineBlock('text', {
  build: (value) => ({ value }),
  refine: { tone: (token) => ({ tone: token }) },
})

// A section heading. `.level()` sets the rank (1-6); defaults to 2.
export const heading = defineBlock('heading', {
  build: (value) => ({ value, level: 2 }),
  refine: { level: (n) => ({ level: n }) },
})

// A small status pill. `.tone()` is the advisory intent ('success' / 'warning' / ...).
export const badge = defineBlock('badge', {
  build: (value) => ({ value }),
  refine: { tone: (token) => ({ tone: token }) },
})

// A horizontal rule. Terminal today, but still a builder so it composes uniformly.
export const divider = defineBlock('divider', { build: () => ({}) })

// A navigation link. `.to()` is a declarative path (no closure, stays serializable) — the
// display-only stand-in for an action until the actions layer lands. `.tone()` styles it.
export const link = defineBlock('link', {
  build: (label) => ({ label }),
  refine: { to: (path) => ({ to: path }), tone: (token) => ({ tone: token }) },
})
