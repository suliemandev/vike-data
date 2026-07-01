// Element builders — the fluent, first-class way to author the leaf blocks of a page.
// `text('Hello')` reads better than `{ block: 'text', value: 'Hello' }`, and it's the same
// pattern the `column()` / `field()` / `display()` builders use one level down: a lowercase
// factory returns a chainable builder whose `.build()` collapses to a plain, serializable
// block descriptor. So an element is just a leaf BLOCK with a nicer surface — it drops
// straight into a view's `sections` and resolves through the same registry.
//
//   defineView({
//     sections: [
//       heading('Post').level(2),
//       { block: 'record', table: 'posts' },
//       badge('Draft').tone('warning'),
//       divider(),
//       link('Back to posts').to('/posts'),
//     ],
//   })
//
// These are DISPLAY-ONLY for now (text / heading / badge / divider / link). Interactivity
// (a button that DOES something) is a separate axis — behavior can't be an inline closure in
// serializable config — and is being scoped as its own thing (see the vike-actions issue);
// `link().to(path)` covers declarative navigation in the meantime.

// A run of text. `.tone()` is an advisory style token the renderer maps to a color/emphasis
// (e.g. 'muted', 'danger'); unknown tones fall back to the default.
export function text(value) {
  const spec = { block: 'text', value }
  const self = {
    tone(token) {
      spec.tone = token
      return self
    },
    build() {
      return { ...spec }
    },
  }
  return self
}

// A section heading. `.level()` sets the heading rank (1-6, default 2).
export function heading(value) {
  const spec = { block: 'heading', value }
  const self = {
    level(n) {
      spec.level = n
      return self
    },
    build() {
      return { level: 2, ...spec }
    },
  }
  return self
}

// A small status pill. `.tone()` is the advisory intent ('success' / 'warning' / 'danger' /
// 'info'); the renderer maps it to a color.
export function badge(value) {
  const spec = { block: 'badge', value }
  const self = {
    tone(token) {
      spec.tone = token
      return self
    },
    build() {
      return { ...spec }
    },
  }
  return self
}

// A horizontal rule. Terminal (no refinements today), but still a builder so it composes
// uniformly and can grow refinements later.
export function divider() {
  return {
    build() {
      return { block: 'divider' }
    },
  }
}

// A navigation link. `.to()` is a declarative path (no closure, so it stays serializable);
// this is the display-only stand-in for an action until vike-actions lands. `.tone()` styles it.
export function link(label) {
  const spec = { block: 'link', label }
  const self = {
    to(path) {
      spec.to = path
      return self
    },
    tone(token) {
      spec.tone = token
      return self
    },
    build() {
      return { ...spec }
    },
  }
  return self
}
